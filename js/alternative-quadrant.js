/* =========================================
   Alternative Design: Quadrant Chart
   ========================================= */

// Dimensions
const margin = { top: 60, right: 100, bottom: 80, left: 100 };
const chartWidth = 800;
const chartHeight = 700;

// State
let data = [];
let medianLife = 0;
let medianSpend = 0;
let highlightedCountry = null;

// Scales
const xScale = d3.scaleLinear().range([0, chartWidth]);
const yScale = d3.scaleLinear().range([chartHeight, 0]);

// Quadrant colors
const quadrantColors = {
  "high-high": "#2ecc71",   // Green - good outcomes, high spending
  "high-low": "#e74c3c",    // Red - poor outcomes despite high spending
  "low-high": "#3498db",    // Blue - efficient, good outcomes with low spending
  "low-low": "#95a5a6"      // Gray - lower outcomes, lower spending
};

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

function getQuadrant(d) {
  const highLife = d.life_expectancy >= medianLife;
  const highSpend = d.health_spending_gdp >= medianSpend;

  if (highSpend && highLife) return "high-high";
  if (highSpend && !highLife) return "high-low";
  if (!highSpend && highLife) return "low-high";
  return "low-low";
}

function getQuadrantLabel(quadrant) {
  const labels = {
    "high-high": "High Spending / High Life Expectancy",
    "high-low": "High Spending / Low Life Expectancy",
    "low-high": "Low Spending / High Life Expectancy (Efficient)",
    "low-low": "Low Spending / Low Life Expectancy"
  };
  return labels[quadrant] || "—";
}

function updateDetails(d) {
  if (!d) {
    d3.select("#quadrantDetailsContent").html(`
      <p><strong>Country:</strong> —</p>
      <p><strong>Quadrant:</strong> —</p>
      <p><strong>Life expectancy:</strong> —</p>
      <p><strong>Health spending:</strong> —</p>
      <p class="muted small">Click on a country to see details</p>
    `);
    return;
  }

  const quadrant = getQuadrant(d);
  d3.select("#quadrantDetailsContent").html(`
    <p><strong>Country:</strong> ${d.country}</p>
    <p><strong>Quadrant:</strong> ${getQuadrantLabel(quadrant)}</p>
    <p><strong>Life expectancy:</strong> ${fmt(d.life_expectancy)} years (median: ${fmt(medianLife)})</p>
    <p><strong>Health spending:</strong> ${fmt(d.health_spending_gdp, 2)}% GDP (median: ${fmt(medianSpend, 2)}%)</p>
  `);
}

function updateQuadrantStats() {
  const quadrants = {
    "high-high": [],
    "high-low": [],
    "low-high": [],
    "low-low": []
  };

  data.forEach((d) => {
    const q = getQuadrant(d);
    quadrants[q].push(d);
  });

  // High-High
  const hh = quadrants["high-high"];
  d3.select("#quadrant-hh-stats").html(`
    <p><strong>${hh.length} countries</strong></p>
    <p class="small">${hh.map((d) => d.country).join(", ")}</p>
  `);

  // High-Low
  const hl = quadrants["high-low"];
  d3.select("#quadrant-hl-stats").html(`
    <p><strong>${hl.length} countries</strong></p>
    <p class="small">${hl.length > 0 ? hl.map((d) => d.country).join(", ") : "None"}</p>
  `);

  // Low-High
  const lh = quadrants["low-high"];
  d3.select("#quadrant-lh-stats").html(`
    <p><strong>${lh.length} countries</strong></p>
    <p class="small">${lh.map((d) => d.country).join(", ")}</p>
  `);

  // Low-Low
  const ll = quadrants["low-low"];
  d3.select("#quadrant-ll-stats").html(`
    <p><strong>${ll.length} countries</strong></p>
    <p class="small">${ll.map((d) => d.country).join(", ")}</p>
  `);
}

function highlightCountry(country) {
  highlightedCountry = country;

  d3.selectAll(".country-circle")
    .transition()
    .duration(200)
    .attr("opacity", (d) => (!country || d.country === country ? 0.9 : 0.2))
    .attr("stroke", (d) => (d.country === country ? "#111" : "#fff"))
    .attr("stroke-width", (d) => (d.country === country ? 3 : 1.5))
    .attr("r", (d) => (d.country === country ? 10 : 7));

  d3.selectAll(".country-label")
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

  data = rawData;

  // Calculate medians
  medianLife = d3.median(data, (d) => d.life_expectancy);
  medianSpend = d3.median(data, (d) => d.health_spending_gdp);

  // Set scale domains with some padding
  xScale.domain([d3.min(data, (d) => d.health_spending_gdp) - 1, d3.max(data, (d) => d.health_spending_gdp) + 1]).nice();
  yScale.domain([d3.min(data, (d) => d.life_expectancy) - 1, d3.max(data, (d) => d.life_expectancy) + 1]).nice();

  // Create SVG
  const svg = d3
    .select("#quadrantChart")
    .append("svg")
    .attr("viewBox", `0 0 ${chartWidth + margin.left + margin.right} ${chartHeight + margin.top + margin.bottom}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "auto");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // Draw quadrant backgrounds
  const quadrantRects = [
    { name: "low-low", x: 0, y: yScale(medianLife), width: xScale(medianSpend), height: chartHeight - yScale(medianLife) },
    { name: "low-high", x: 0, y: 0, width: xScale(medianSpend), height: yScale(medianLife) },
    { name: "high-low", x: xScale(medianSpend), y: yScale(medianLife), width: chartWidth - xScale(medianSpend), height: chartHeight - yScale(medianLife) },
    { name: "high-high", x: xScale(medianSpend), y: 0, width: chartWidth - xScale(medianSpend), height: yScale(medianLife) }
  ];

  g.selectAll(".quadrant-bg")
    .data(quadrantRects)
    .enter()
    .append("rect")
    .attr("class", "quadrant-bg")
    .attr("x", (d) => d.x)
    .attr("y", (d) => d.y)
    .attr("width", (d) => d.width)
    .attr("height", (d) => d.height)
    .attr("fill", (d) => quadrantColors[d.name])
    .attr("opacity", 0.1);

  // Add quadrant labels
  const quadrantLabels = [
    { name: "Low Spending\nLow Life Expectancy", x: xScale(medianSpend) / 2, y: (chartHeight + yScale(medianLife)) / 2 },
    { name: "Low Spending\nHigh Life Expectancy\n(Efficient)", x: xScale(medianSpend) / 2, y: yScale(medianLife) / 2 },
    { name: "High Spending\nLow Life Expectancy", x: (xScale(medianSpend) + chartWidth) / 2, y: (chartHeight + yScale(medianLife)) / 2 },
    { name: "High Spending\nHigh Life Expectancy", x: (xScale(medianSpend) + chartWidth) / 2, y: yScale(medianLife) / 2 }
  ];

  g.selectAll(".quadrant-label")
    .data(quadrantLabels)
    .enter()
    .append("text")
    .attr("class", "quadrant-label")
    .attr("x", (d) => d.x)
    .attr("y", (d) => d.y)
    .attr("text-anchor", "middle")
    .attr("font-size", "14px")
    .attr("font-weight", "600")
    .attr("fill", "#999")
    .attr("opacity", 0.6)
    .selectAll("tspan")
    .data((d) => d.name.split("\n"))
    .enter()
    .append("tspan")
    .attr("x", function() { return d3.select(this.parentNode).attr("x"); })
    .attr("dy", (d, i) => i === 0 ? 0 : "1.2em")
    .text((d) => d);

  // Draw median lines
  g.append("line")
    .attr("x1", xScale(medianSpend))
    .attr("y1", 0)
    .attr("x2", xScale(medianSpend))
    .attr("y2", chartHeight)
    .attr("stroke", "#333")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "8 4");

  g.append("line")
    .attr("x1", 0)
    .attr("y1", yScale(medianLife))
    .attr("x2", chartWidth)
    .attr("y2", yScale(medianLife))
    .attr("stroke", "#333")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "8 4");

  // Axes
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3.axisLeft(yScale);

  g.append("g")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(xAxis)
    .call((g) => g.select(".domain").attr("stroke-width", 1.5));

  g.append("g")
    .call(yAxis)
    .call((g) => g.select(".domain").attr("stroke-width", 1.5));

  // Axis labels
  g.append("text")
    .attr("x", chartWidth / 2)
    .attr("y", chartHeight + 50)
    .attr("text-anchor", "middle")
    .attr("font-size", "14px")
    .attr("font-weight", "500")
    .attr("fill", "#222")
    .text("Health Spending (% of GDP)");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -chartHeight / 2)
    .attr("y", -70)
    .attr("text-anchor", "middle")
    .attr("font-size", "14px")
    .attr("font-weight", "500")
    .attr("fill", "#222")
    .text("Life Expectancy (years)");

  // Median value labels
  g.append("text")
    .attr("x", xScale(medianSpend) + 5)
    .attr("y", -10)
    .attr("font-size", "12px")
    .attr("font-weight", "500")
    .attr("fill", "#333")
    .text(`Median: ${fmt(medianSpend, 2)}%`);

  g.append("text")
    .attr("x", -5)
    .attr("y", yScale(medianLife) - 5)
    .attr("text-anchor", "end")
    .attr("font-size", "12px")
    .attr("font-weight", "500")
    .attr("fill", "#333")
    .text(`Median: ${fmt(medianLife, 1)} yrs`);

  // Add country circles
  const circles = g
    .selectAll(".country-circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "country-circle")
    .attr("cx", (d) => xScale(d.health_spending_gdp))
    .attr("cy", (d) => yScale(d.life_expectancy))
    .attr("r", 7)
    .attr("fill", (d) => quadrantColors[getQuadrant(d)])
    .attr("opacity", 0.8)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1.5)
    .style("cursor", "pointer")
    .on("mouseover", function (event, d) {
      tooltip
        .style("opacity", 1)
        .html(
          `<strong>${d.country}</strong><br/>
           Quadrant: ${getQuadrantLabel(getQuadrant(d))}<br/>
           Life expectancy: ${fmt(d.life_expectancy)} years<br/>
           Health spending: ${fmt(d.health_spending_gdp, 2)}% GDP`
        );

      highlightCountry(d.country);
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
      d3.select("#quadrantCountrySelect").property("value", d.country);
    });

  // Add country labels
  g.selectAll(".country-label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "country-label")
    .attr("x", (d) => xScale(d.health_spending_gdp))
    .attr("y", (d) => yScale(d.life_expectancy) - 12)
    .attr("text-anchor", "middle")
    .style("font-size", "9px")
    .style("fill", "#333")
    .style("pointer-events", "none")
    .text((d) => d.country);

  // Update statistics
  updateQuadrantStats();

  // Populate dropdown
  const select = d3.select("#quadrantCountrySelect");
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
  d3.select("#quadrantResetBtn").on("click", () => {
    clearHighlight();
    select.property("value", "");
  });

  // Click background to clear
  svg.on("click", () => {
    clearHighlight();
    select.property("value", "");
  });
});
