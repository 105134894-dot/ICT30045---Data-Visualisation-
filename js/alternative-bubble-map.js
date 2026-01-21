/* =========================================
   Alternative Design: Geographic Bubble Map
   ========================================= */

// Approximate geographic coordinates for OECD countries (normalized to 0-100 scale)
const countryPositions = {
  "Japan": { x: 90, y: 45 },
  "Korea": { x: 88, y: 47 },
  "Australia": { x: 88, y: 75 },
  "New Zealand": { x: 95, y: 78 },
  "Israel": { x: 55, y: 52 },
  "Türkiye": { x: 54, y: 48 },
  "United States": { x: 20, y: 46 },
  "Canada": { x: 20, y: 35 },
  "Mexico": { x: 18, y: 52 },
  "Chile": { x: 28, y: 72 },
  "Colombia": { x: 26, y: 58 },
  "Costa Rica": { x: 22, y: 58 },
  "Iceland": { x: 42, y: 25 },
  "Norway": { x: 48, y: 28 },
  "Sweden": { x: 50, y: 30 },
  "Finland": { x: 52, y: 28 },
  "Denmark": { x: 48, y: 34 },
  "Estonia": { x: 52, y: 32 },
  "Latvia": { x: 52, y: 34 },
  "Lithuania": { x: 52, y: 36 },
  "Poland": { x: 50, y: 38 },
  "Germany": { x: 48, y: 38 },
  "Netherlands": { x: 46, y: 37 },
  "Belgium": { x: 46, y: 38 },
  "Luxembourg": { x: 46, y: 39 },
  "France": { x: 45, y: 41 },
  "Switzerland": { x: 47, y: 41 },
  "Austria": { x: 49, y: 41 },
  "Czechia": { x: 49, y: 39 },
  "Slovak Rep.": { x: 50, y: 40 },
  "Hungary": { x: 50, y: 41 },
  "Slovenia": { x: 49, y: 42 },
  "Italy": { x: 48, y: 44 },
  "Spain": { x: 44, y: 45 },
  "Portugal": { x: 42, y: 46 },
  "Greece": { x: 51, y: 46 },
  "United Kingdom": { x: 44, y: 36 },
  "Ireland": { x: 42, y: 37 }
};

// Dimensions
const margin = { top: 40, right: 40, bottom: 40, left: 40 };
const mapWidth = 1000;
const mapHeight = 600;

// State
let data = [];
let highlightedCountry = null;

// Scales
const xScale = d3.scaleLinear().domain([0, 100]).range([0, mapWidth]);
const yScale = d3.scaleLinear().domain([0, 100]).range([0, mapHeight]);
const sizeScale = d3.scaleSqrt().range([8, 40]); // Bubble size based on spending
const colorScale = d3.scaleSequential(d3.interpolateYlGnBu).domain([74, 84]); // Life expectancy

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

function fmt(n, digits = 1) {
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

function updateDetails(d) {
  if (!d) {
    d3.select("#mapDetailsContent").html(`
      <p><strong>Country:</strong> —</p>
      <p><strong>Life expectancy:</strong> —</p>
      <p><strong>Health spending:</strong> —</p>
      <p class="muted small">Hover over or select a country to see details</p>
    `);
    return;
  }

  d3.select("#mapDetailsContent").html(`
    <p><strong>Country:</strong> ${d.country}</p>
    <p><strong>Life expectancy:</strong> ${fmt(d.life_expectancy)} years</p>
    <p><strong>Health spending:</strong> ${fmt(d.health_spending_gdp, 2)}% GDP</p>
  `);
}

function highlightCountry(country) {
  highlightedCountry = country;

  d3.selectAll(".bubble")
    .transition()
    .duration(200)
    .attr("opacity", (d) => (!country || d.country === country ? 0.8 : 0.2))
    .attr("stroke", (d) => (d.country === country ? "#111" : "#fff"))
    .attr("stroke-width", (d) => (d.country === country ? 3 : 1));

  d3.selectAll(".bubble-label")
    .transition()
    .duration(200)
    .style("font-weight", (d) => (d.country === country ? "bold" : "normal"))
    .style("opacity", (d) => (!country || d.country === country ? 1 : 0.3));
}

function clearHighlight() {
  highlightedCountry = null;
  highlightCountry(null);
  updateDetails(null);
}

// Load data
d3.csv("data/merged.csv").then((rawData) => {
  // Parse data
  rawData.forEach((d) => {
    d.life_expectancy = +d.life_expectancy;
    d.health_spending_gdp = +d.health_spending_gdp;
  });

  data = rawData.filter((d) => countryPositions[d.country]); // Only countries with positions

  // Set scale domains
  sizeScale.domain([0, d3.max(data, (d) => d.health_spending_gdp)]);

  // Create SVG
  const svg = d3
    .select("#mapChart")
    .append("svg")
    .attr("viewBox", `0 0 ${mapWidth + margin.left + margin.right} ${mapHeight + margin.top + margin.bottom}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "auto");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // Add background regions (continents) for context
  const regions = [
    { name: "North America", x: 15, y: 20, width: 15, height: 40 },
    { name: "Europe", x: 40, y: 25, width: 15, height: 25 },
    { name: "Asia-Pacific", x: 85, y: 35, width: 15, height: 50 }
  ];

  g.selectAll(".region")
    .data(regions)
    .enter()
    .append("rect")
    .attr("class", "region")
    .attr("x", (d) => xScale(d.x))
    .attr("y", (d) => yScale(d.y))
    .attr("width", (d) => xScale(d.width) - xScale(0))
    .attr("height", (d) => yScale(d.height) - yScale(0))
    .attr("fill", "#f0f0f0")
    .attr("opacity", 0.3)
    .attr("rx", 8);

  g.selectAll(".region-label")
    .data(regions)
    .enter()
    .append("text")
    .attr("class", "region-label")
    .attr("x", (d) => xScale(d.x + d.width / 2))
    .attr("y", (d) => yScale(d.y + d.height / 2))
    .attr("text-anchor", "middle")
    .attr("font-size", "20px")
    .attr("font-weight", "bold")
    .attr("fill", "#ddd")
    .attr("opacity", 0.5)
    .text((d) => d.name);

  // Add bubbles
  const bubbles = g
    .selectAll(".bubble")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "bubble")
    .attr("cx", (d) => {
      const pos = countryPositions[d.country];
      return xScale(pos.x);
    })
    .attr("cy", (d) => {
      const pos = countryPositions[d.country];
      return yScale(pos.y);
    })
    .attr("r", (d) => sizeScale(d.health_spending_gdp))
    .attr("fill", (d) => colorScale(d.life_expectancy))
    .attr("opacity", 0.7)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      tooltip
        .style("opacity", 1)
        .html(
          `<strong>${d.country}</strong><br/>
           Life expectancy: ${fmt(d.life_expectancy)} years<br/>
           Health spending: ${fmt(d.health_spending_gdp, 2)}% GDP`
        );

      highlightCountry(d.country);
      updateDetails(d);
    })
    .on("mousemove", (event) => {
      tooltip.style("left", event.pageX + 12 + "px").style("top", event.pageY - 18 + "px");
    })
    .on("mouseout", () => {
      tooltip.style("opacity", 0);
    })
    .on("click", (event, d) => {
      event.stopPropagation();
      highlightCountry(d.country);
      updateDetails(d);
      d3.select("#bubbleCountrySelect").property("value", d.country);
    });

  // Add country labels (only show for non-overlapping positions)
  const labels = g
    .selectAll(".bubble-label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "bubble-label")
    .attr("x", (d) => {
      const pos = countryPositions[d.country];
      return xScale(pos.x);
    })
    .attr("y", (d) => {
      const pos = countryPositions[d.country];
      return yScale(pos.y) + sizeScale(d.health_spending_gdp) + 12;
    })
    .attr("text-anchor", "middle")
    .style("font-size", "10px")
    .style("fill", "#333")
    .style("pointer-events", "none")
    .text((d) => d.country);

  // Populate dropdown
  const select = d3.select("#bubbleCountrySelect");
  select
    .selectAll("option.country")
    .data(data.map((d) => d.country).sort())
    .enter()
    .append("option")
    .attr("class", "country")
    .attr("value", (d) => d)
    .text((d) => d);

  // Dropdown change
  select.on("change", function () {
    const country = this.value;
    if (!country) {
      clearHighlight();
      return;
    }

    const countryData = data.find((d) => d.country === country);
    if (countryData) {
      highlightCountry(country);
      updateDetails(countryData);
    }
  });

  // Reset button
  d3.select("#bubbleResetBtn").on("click", () => {
    clearHighlight();
    select.property("value", "");
  });

  // Click background to clear
  svg.on("click", () => {
    clearHighlight();
    select.property("value", "");
  });
});
