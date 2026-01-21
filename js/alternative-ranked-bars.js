/* =========================================
   Alternative Design: Dual Ranked Bar Charts
   ========================================= */

// Dimensions
const margin = { top: 20, right: 80, bottom: 40, left: 180 };
const chartHeight = 1400; // Taller to accommodate 39 countries
const chartWidth = 500;

// State
let data = [];
let highlightedCountry = null;

// Scales
const xScaleLeft = d3.scaleLinear().range([0, chartWidth]);
const xScaleRight = d3.scaleLinear().range([0, chartWidth]);

// Color scales
const colorLife = d3.scaleSequential(d3.interpolateBlues).domain([74, 85]);
const colorSpend = d3.scaleSequential(d3.interpolateOranges).domain([4, 17]);

// Tooltip
const tooltip = d3
  .select("body")
  .append("div")
  .style("position", "absolute")
  .style("background", "#fff")
  .style("border", "1px solid #ccc")
  .style("padding", "8px 10px")
  .style("border-radius", "6px")
  .style("box-shadow", "0 2px 8px rgba(0,0,0,0.12)")
  .style("pointer-events", "none")
  .style("opacity", 0)
  .style("font-size", "13px");

// Helper functions
function fmt(n, digits = 1) {
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

function updateDetails(d, lifeRank, spendRank) {
  if (!d) {
    d3.select("#detailsContent").html(`
      <p><strong>Country:</strong> —</p>
      <p><strong>Life expectancy rank:</strong> —</p>
      <p><strong>Life expectancy:</strong> —</p>
      <p><strong>Health spending rank:</strong> —</p>
      <p><strong>Health spending:</strong> —</p>
      <p class="muted small">Hover over or search for a country to see details</p>
    `);
    return;
  }

  d3.select("#detailsContent").html(`
    <p><strong>Country:</strong> ${d.country}</p>
    <p><strong>Life expectancy rank:</strong> #${lifeRank} of 39</p>
    <p><strong>Life expectancy:</strong> ${fmt(d.life_expectancy)} years</p>
    <p><strong>Health spending rank:</strong> #${spendRank} of 39</p>
    <p><strong>Health spending:</strong> ${fmt(d.health_spending_gdp, 2)}% GDP</p>
  `);
}

function highlightCountry(country) {
  highlightedCountry = country;

  // Highlight left bars
  d3.selectAll(".bar-left")
    .transition()
    .duration(200)
    .attr("opacity", (d) => (!country || d.country === country ? 1 : 0.2))
    .attr("stroke", (d) => (d.country === country ? "#111" : "none"))
    .attr("stroke-width", (d) => (d.country === country ? 2 : 0));

  // Highlight right bars
  d3.selectAll(".bar-right")
    .transition()
    .duration(200)
    .attr("opacity", (d) => (!country || d.country === country ? 1 : 0.2))
    .attr("stroke", (d) => (d.country === country ? "#111" : "none"))
    .attr("stroke-width", (d) => (d.country === country ? 2 : 0));

  // Highlight labels
  d3.selectAll(".label-left")
    .transition()
    .duration(200)
    .style("font-weight", (d) => (d.country === country ? "bold" : "normal"))
    .style("opacity", (d) => (!country || d.country === country ? 1 : 0.4));

  d3.selectAll(".label-right")
    .transition()
    .duration(200)
    .style("font-weight", (d) => (d.country === country ? "bold" : "normal"))
    .style("opacity", (d) => (!country || d.country === country ? 1 : 0.4));
}

function clearHighlight() {
  highlightedCountry = null;
  highlightCountry(null);
  updateDetails(null);
}

// Load and process data
d3.csv("data/merged.csv").then((rawData) => {
  // Parse data
  rawData.forEach((d) => {
    d.life_expectancy = +d.life_expectancy;
    d.health_spending_gdp = +d.health_spending_gdp;
  });

  data = rawData;

  // Sort for rankings
  const dataByLife = [...data].sort((a, b) => b.life_expectancy - a.life_expectancy);
  const dataBySpend = [...data].sort((a, b) => b.health_spending_gdp - a.health_spending_gdp);

  // Set scale domains
  xScaleLeft.domain([0, d3.max(data, (d) => d.life_expectancy)]).nice();
  xScaleRight.domain([0, d3.max(data, (d) => d.health_spending_gdp)]).nice();

  // Render left chart (Life Expectancy)
  renderChart(
    "#chartLeft",
    dataByLife,
    xScaleLeft,
    (d) => d.life_expectancy,
    colorLife,
    "bar-left",
    "label-left",
    "years"
  );

  // Render right chart (Health Spending)
  renderChart(
    "#chartRight",
    dataBySpend,
    xScaleRight,
    (d) => d.health_spending_gdp,
    colorSpend,
    "bar-right",
    "label-right",
    "% GDP"
  );

  // Search functionality
  const searchInput = d3.select("#countrySearch");
  searchInput.on("input", function () {
    const searchTerm = this.value.toLowerCase().trim();
    if (!searchTerm) {
      clearHighlight();
      return;
    }

    const match = data.find((d) => d.country.toLowerCase().includes(searchTerm));
    if (match) {
      const lifeRank = dataByLife.findIndex((d) => d.country === match.country) + 1;
      const spendRank = dataBySpend.findIndex((d) => d.country === match.country) + 1;
      highlightCountry(match.country);
      updateDetails(match, lifeRank, spendRank);
    } else {
      clearHighlight();
    }
  });

  // Reset button
  d3.select("#resetBtn").on("click", () => {
    clearHighlight();
    searchInput.property("value", "");
  });

  function renderChart(
    selector,
    sortedData,
    xScale,
    valueAccessor,
    colorScale,
    barClass,
    labelClass,
    unit
  ) {
    const svg = d3
      .select(selector)
      .append("svg")
      .attr("width", chartWidth + margin.left + margin.right)
      .attr("height", chartHeight + margin.top + margin.bottom);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Y scale (ordinal - one bar per country)
    const yScale = d3
      .scaleBand()
      .domain(sortedData.map((d) => d.country))
      .range([0, chartHeight])
      .padding(0.15);

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale).ticks(5))
      .call((g) => g.select(".domain").remove())
      .selectAll("text")
      .style("font-size", "11px");

    // Bars
    const bars = g
      .selectAll(`.${barClass}`)
      .data(sortedData)
      .enter()
      .append("rect")
      .attr("class", barClass)
      .attr("x", 0)
      .attr("y", (d) => yScale(d.country))
      .attr("width", (d) => xScale(valueAccessor(d)))
      .attr("height", yScale.bandwidth())
      .attr("fill", (d) => colorScale(valueAccessor(d)))
      .attr("opacity", 1)
      .attr("rx", 3)
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        const rank = sortedData.findIndex((c) => c.country === d.country) + 1;
        tooltip
          .style("opacity", 1)
          .html(
            `<strong>${d.country}</strong><br/>
             Rank: #${rank}<br/>
             Value: ${fmt(valueAccessor(d), 2)} ${unit}`
          );

        highlightCountry(d.country);

        // Get ranks
        const dataByLife = [...data].sort((a, b) => b.life_expectancy - a.life_expectancy);
        const dataBySpend = [...data].sort((a, b) => b.health_spending_gdp - a.health_spending_gdp);
        const lifeRank = dataByLife.findIndex((c) => c.country === d.country) + 1;
        const spendRank = dataBySpend.findIndex((c) => c.country === d.country) + 1;

        updateDetails(d, lifeRank, spendRank);
      })
      .on("mousemove", (event) => {
        tooltip.style("left", event.pageX + 12 + "px").style("top", event.pageY - 18 + "px");
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
        // Don't clear highlight on mouseout - let it persist
      });

    // Country labels
    g.selectAll(`.${labelClass}`)
      .data(sortedData)
      .enter()
      .append("text")
      .attr("class", labelClass)
      .attr("x", -8)
      .attr("y", (d) => yScale(d.country) + yScale.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .style("font-size", "11px")
      .style("fill", "#333")
      .text((d) => d.country)
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        highlightCountry(d.country);

        // Get ranks
        const dataByLife = [...data].sort((a, b) => b.life_expectancy - a.life_expectancy);
        const dataBySpend = [...data].sort((a, b) => b.health_spending_gdp - a.health_spending_gdp);
        const lifeRank = dataByLife.findIndex((c) => c.country === d.country) + 1;
        const spendRank = dataBySpend.findIndex((c) => c.country === d.country) + 1;

        updateDetails(d, lifeRank, spendRank);
      });

    // Value labels (at end of bars)
    g.selectAll(`.value-${labelClass}`)
      .data(sortedData)
      .enter()
      .append("text")
      .attr("class", `value-${labelClass}`)
      .attr("x", (d) => xScale(valueAccessor(d)) + 5)
      .attr("y", (d) => yScale(d.country) + yScale.bandwidth() / 2)
      .attr("dy", "0.35em")
      .style("font-size", "10px")
      .style("fill", "#666")
      .text((d) => fmt(valueAccessor(d), 2));
  }
});
