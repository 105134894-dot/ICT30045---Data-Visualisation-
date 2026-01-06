const dataPath = "data/merged.csv";

// Increased size + more top margin to prevent legend cutoff
const margin = { top: 55, right: 35, bottom: 60, left: 75 };
const outerWidth = 1040;
const outerHeight = 620;
const width = outerWidth - margin.left - margin.right;
const height = outerHeight - margin.top - margin.bottom;

const tooltip = d3.select("#tooltip");

const svg = d3.select("#chart")
  .append("svg")
  .attr("width", outerWidth)
  .attr("height", outerHeight);

const g = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const x = d3.scaleLinear().range([0, width]);
const y = d3.scaleLinear().range([height, 0]);

const xAxisG = g.append("g").attr("transform", `translate(0,${height})`);
const yAxisG = g.append("g");

// Axis labels
g.append("text")
  .attr("x", width / 2)
  .attr("y", height + 45)
  .attr("text-anchor", "middle")
  .text("Health spending (% of GDP, 2023)");

g.append("text")
  .attr("transform", "rotate(-90)")
  .attr("x", -height / 2)
  .attr("y", -55)
  .attr("text-anchor", "middle")
  .text("Life expectancy at birth (years, 2022)");

// Linear regression helper
function linearRegression(data) {
  const n = data.length;
  const sumX = d3.sum(data, d => d.health_spending_gdp);
  const sumY = d3.sum(data, d => d.life_expectancy);
  const sumXY = d3.sum(data, d => d.health_spending_gdp * d.life_expectancy);
  const sumXX = d3.sum(data, d => d.health_spending_gdp * d.health_spending_gdp);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

d3.csv(dataPath, d => ({
  country: d.country,
  life_expectancy: +d.life_expectancy,
  health_spending_gdp: +d.health_spending_gdp
}))
.then(data => {
  data = data.filter(d =>
    d.country &&
    !isNaN(d.life_expectancy) &&
    !isNaN(d.health_spending_gdp)
  );

  console.log("✅ Loaded rows:", data.length);

  // Domains
  x.domain(d3.extent(data, d => d.health_spending_gdp)).nice();
  y.domain(d3.extent(data, d => d.life_expectancy)).nice();

  // Axes
  xAxisG.call(d3.axisBottom(x));
  yAxisG.call(d3.axisLeft(y));

  // --- Colour scale: Green → Amber → Red ---
  const spendExtent = d3.extent(data, d => d.health_spending_gdp);
  const spendMid = (spendExtent[0] + spendExtent[1]) / 2;

  const color = d3.scaleLinear()
    .domain([spendExtent[0], spendMid, spendExtent[1]])
    .range(["#2ca25f", "#fdae61", "#d73027"]);

  // --- Legend (continuous bar) ---
  const legendW = 180;
  const legendH = 10;

  const defs = svg.append("defs");
  const gradId = "spendGradient";

  const gradient = defs.append("linearGradient")
    .attr("id", gradId)
    .attr("x1", "0%")
    .attr("x2", "100%")
    .attr("y1", "0%")
    .attr("y2", "0%");

  const stops = [0, 0.5, 1];
  gradient.selectAll("stop")
    .data(stops)
    .join("stop")
    .attr("offset", d => `${d * 100}%`)
    .attr("stop-color", d => {
      const v = spendExtent[0] + d * (spendExtent[1] - spendExtent[0]);
      return color(v);
    });

  const legend = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${margin.left + width - legendW},${margin.top - 35})`);

  legend.append("text")
    .attr("x", 0)
    .attr("y", 0)
    .text("Spending intensity");

  legend.append("rect")
    .attr("x", 0)
    .attr("y", 6)
    .attr("width", legendW)
    .attr("height", legendH)
    .attr("fill", `url(#${gradId})`)
    .attr("stroke", "#999")
    .attr("opacity", 0.95);

  legend.append("text")
    .attr("x", 0)
    .attr("y", 28)
    .text(`${spendExtent[0].toFixed(1)}%`);

  legend.append("text")
    .attr("x", legendW)
    .attr("y", 28)
    .attr("text-anchor", "end")
    .text(`${spendExtent[1].toFixed(1)}%`);

  // --- Trendline group (hidden by default) ---
  const trendGroup = g.append("g")
    .attr("class", "trendline")
    .style("display", "none");

  const { slope, intercept } = linearRegression(data);
  const xVals = d3.extent(data, d => d.health_spending_gdp);

  const yAtMin = slope * xVals[0] + intercept;
  const yAtMax = slope * xVals[1] + intercept;

  trendGroup.append("line")
    .attr("x1", x(xVals[0]))
    .attr("y1", y(yAtMin))
    .attr("x2", x(xVals[1]))
    .attr("y2", y(yAtMax))
    .attr("stroke", "black")
    .attr("stroke-width", 2)
    .attr("opacity", 0.35);

  trendGroup.append("text")
    .attr("x", 10)
    .attr("y", 10)
    .attr("font-size", 12)
    .attr("opacity", 0.7)
    .text(`Trendline: y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)}`);

  // --- Country dropdown (define early so brush can reference it safely) ---
  const select = d3.select("#countrySelect");

  // Populate dropdown
  select.selectAll("option.country")
    .data(data.map(d => d.country).sort(d3.ascending))
    .join("option")
    .attr("class", "country")
    .attr("value", d => d)
    .text(d => d);

  // -----------------------------
  // DOTS (create BEFORE brush)
  // -----------------------------
  let colourOn = true;

  const dots = g.selectAll("circle")
    .data(data)
    .join("circle")
    .attr("cx", d => x(d.health_spending_gdp))
    .attr("cy", d => y(d.life_expectancy))
    .attr("r", 5)
    .attr("fill", d => (colourOn ? color(d.health_spending_gdp) : "#666"))
    .attr("stroke", "#111")
    .attr("stroke-width", 0.4)
    .attr("opacity", 0.9);

  // Tooltip events (no USA outlier messaging)
  dots
    .on("mousemove", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(
          `<strong>${d.country}</strong><br/>
           Life expectancy: ${d.life_expectancy}<br/>
           Health spending: ${d.health_spending_gdp}%`
        )
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`)
        .attr("aria-hidden", "false");
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0).attr("aria-hidden", "true");
    });

  // --- Trendline toggle button ---
  let trendVisible = false;
  const trendBtn = d3.select("#toggleTrendline");

  trendBtn.on("click", () => {
    trendVisible = !trendVisible;

    trendGroup.style("display", trendVisible ? null : "none");
    trendBtn.attr("aria-pressed", String(trendVisible))
      .text(trendVisible ? "Hide trendline" : "Show trendline");
  });

  // --- Colour toggle button ---
  const colourBtn = d3.select("#toggleColour");

  function applyColourState() {
    dots.attr("fill", d => (colourOn ? color(d.health_spending_gdp) : "#666"));
    legend.style("display", colourOn ? null : "none");
    colourBtn
      .attr("aria-pressed", String(colourOn))
      .text(colourOn ? "Colour: On" : "Colour: Off");
  }

  colourBtn.on("click", () => {
    colourOn = !colourOn;
    applyColourState();
  });

  applyColourState();

  // -----------------------------
  // BRUSH (now safe: dots exists)
  // -----------------------------
  const brushLayer = g.append("g").attr("class", "brush");

  // ✅ Flag to prevent brush end from resetting dropdown when we clear brush programmatically
  let suppressBrushEndReset = false;

  function brushed({ selection }) {
    // If no selection: reset
    if (!selection) {
      dots
        .attr("opacity", 0.9)
        .attr("r", 5)
        .attr("stroke-width", 0.4);
      return;
    }

    const [[x0, y0], [x1, y1]] = selection;

    dots
      .attr("opacity", d => {
        const cx = x(d.health_spending_gdp);
        const cy = y(d.life_expectancy);
        const inside = x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
        return inside ? 1 : 0.12;
      })
      .attr("r", d => {
        const cx = x(d.health_spending_gdp);
        const cy = y(d.life_expectancy);
        const inside = x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
        return inside ? 7 : 5;
      })
      .attr("stroke-width", d => {
        const cx = x(d.health_spending_gdp);
        const cy = y(d.life_expectancy);
        const inside = x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
        return inside ? 0.9 : 0.4;
      });
  }

  function brushEnded({ selection }) {
    // ✅ If dropdown cleared the brush, don't override dropdown selection
    if (suppressBrushEndReset) return;

    // Reset dropdown to avoid conflicting states when user brushes
    if (selection) {
      select.property("value", "__ALL__");
    } else {
      // Brush cleared manually -> reset everything
      select.property("value", "__ALL__");
      dots
        .attr("opacity", 0.9)
        .attr("r", 5)
        .attr("stroke-width", 0.4);
    }
  }

  const brush = d3.brush()
    .extent([[0, 0], [width, height]])
    .on("brush", brushed)
    .on("end", brushEnded);

  brushLayer.call(brush);

  // -----------------------------
  // DROPDOWN HIGHLIGHT (fixed)
  // -----------------------------
  select.on("change", function () {
    const chosen = this.value; // ✅ capture before brush clear can fire end-event

    // Clear brush rectangle if user switches to dropdown highlight
    suppressBrushEndReset = true;
    brushLayer.call(brush.move, null);
    suppressBrushEndReset = false;

    if (chosen === "__ALL__") {
      dots
        .attr("opacity", 0.9)
        .attr("r", 5)
        .attr("stroke-width", 0.4);
      return;
    }

    dots
      .attr("opacity", d => (d.country === chosen ? 1 : 0.12))
      .attr("r", d => (d.country === chosen ? 7 : 5))
      .attr("stroke-width", d => (d.country === chosen ? 0.9 : 0.4));
  });

  // Ensure dots stay above brush overlay for interaction
  dots.raise();

})
.catch(err => {
  console.error("❌ CSV load error:", err);
});
