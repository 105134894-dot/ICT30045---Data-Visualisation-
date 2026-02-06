/* =========================
   State + sizing
========================= */

const margin = { top: 70, right: 50, bottom: 80, left: 90 };
const outerHeight = 620; // keep height stable (safe + readable)

function getChartOuterWidth() {
  const el = document.getElementById("chart");
  return el ? Math.max(520, el.clientWidth) : 980; // minimum width safety
}

let outerWidth = getChartOuterWidth();
let width = outerWidth - margin.left - margin.right;
let height = outerHeight - margin.top - margin.bottom;

//  state (these were missing — caused your errors)
let showTrend = false;
let showColour = false;
let pinnedCountry = "";
let brushedCountries = [];

function updateCountSummary() {
  const countDiv = d3.select("#countSummary");
  const unique = new Set(brushedCountries.map(d => d.country));
  if (pinnedCountry) unique.add(pinnedCountry);
  if (unique.size === 0) {
    countDiv.text("");
  } else {
    countDiv.text(`${unique.size} ${unique.size === 1 ? "Country" : "Countries"} selected`);
  }
}

/* =========================
   Scales + utilities
========================= */

// Green → Amber → Red (spending intensity)
const colourScale = d3
  .scaleLinear()
  .domain([5, 10, 17])
  .range(["#2ecc71", "#f1c40f", "#e74c3c"])
  .clamp(true);

// Tooltip
const tooltip = d3
  .select("body")
  .append("div")
  .style("position", "absolute")
  .style("background", "#fff")
  .style("border", "1px solid #ccc")
  .style("padding", "6px 8px")
  .style("border-radius", "6px")
  .style("box-shadow", "0 1px 8px rgba(0,0,0,0.08)")
  .style("pointer-events", "none")
  .style("opacity", 0);

function fmt(n, digits = 2) {
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

// Regression helper (least squares): y = a + b*x
function linearRegression(data, xAccessor, yAccessor) {
  const meanX = d3.mean(data, xAccessor);
  const meanY = d3.mean(data, yAccessor);

  let num = 0;
  let den = 0;
  for (const d of data) {
    const x = xAccessor(d);
    const y = yAccessor(d);
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) * (x - meanX);
  }
  const b = den === 0 ? 0 : num / den;
  const a = meanY - b * meanX;
  return { a, b, predict: (x) => a + b * x };
}

/* =========================
   Legend
========================= */

function renderLegend() {
  const legendDiv = d3.select("#legend");
  legendDiv.style("display", "none").attr("aria-hidden", "true").html("");

  const w = 220;
  const h = 36;

  const svg = legendDiv.append("svg").attr("width", w).attr("height", h);

  const defs = svg.append("defs");
  const grad = defs
    .append("linearGradient")
    .attr("id", "spendGrad")
    .attr("x1", "0%")
    .attr("x2", "100%")
    .attr("y1", "0%")
    .attr("y2", "0%");

  grad.append("stop").attr("offset", "0%").attr("stop-color", "#2ecc71");
  grad.append("stop").attr("offset", "50%").attr("stop-color", "#f1c40f");
  grad.append("stop").attr("offset", "100%").attr("stop-color", "#e74c3c");

  svg
    .append("rect")
    .attr("x", 10)
    .attr("y", 10)
    .attr("width", 160)
    .attr("height", 14)
    .attr("rx", 4)
    .attr("fill", "url(#spendGrad)")
    .attr("stroke", "#ccc");

  svg
    .append("text")
    .attr("x", 10)
    .attr("y", 32)
    .attr("font-size", 11)
    .attr("fill", "#444")
    .text("Lower");

  svg
    .append("text")
    .attr("x", 170)
    .attr("y", 32)
    .attr("text-anchor", "end")
    .attr("font-size", 11)
    .attr("fill", "#444")
    .text("Higher");

  svg
    .append("text")
    .attr("x", 210)
    .attr("y", 20)
    .attr("text-anchor", "end")
    .attr("font-size", 11)
    .attr("fill", "#444")
    .text("% GDP");
}

renderLegend();

/* =========================
   SVG scaffolding
========================= */

const svg = d3
  .select("#chart")
  .append("svg")
  .attr("viewBox", `0 0 ${outerWidth} ${outerHeight}`)
  .attr("preserveAspectRatio", "xMidYMid meet")
  .style("width", "100%")
  .style("height", "auto");

const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

const x = d3.scaleLinear().range([0, width]);
const y = d3.scaleLinear().range([height, 0]);

const xAxisG = g.append("g").attr("transform", `translate(0,${height})`);
const yAxisG = g.append("g");

const xLabel = g
  .append("text")
  .attr("x", width / 2)
  .attr("y", height + 55)
  .attr("text-anchor", "middle")
  .attr("font-size", 13)
  .attr("fill", "#222")
  .text("Health spending (% of GDP)");

const yLabel = g
  .append("text")
  .attr("transform", "rotate(-90)")
  .attr("x", -height / 2)
  .attr("y", -65)
  .attr("text-anchor", "middle")
  .attr("font-size", 13)
  .attr("fill", "#222")
  .text("Life expectancy (years)");

// Brush layer (behind dots)
const brushLayer = g.insert("g", ":first-child");

// Trendline
const trendline = g
  .append("line")
  .style("stroke", "#222")
  .style("stroke-width", 2)
  .style("stroke-dasharray", "6 4")
  .style("opacity", 0);

/* =========================
   Data load + interactions
========================= */

d3.csv("data/merged.csv").then((data) => {
  data.forEach((d) => {
    d.life_expectancy = +d.life_expectancy;
    d.health_spending_gdp = +d.health_spending_gdp;
  });

  x.domain(d3.extent(data, (d) => d.health_spending_gdp)).nice();
  y.domain(d3.extent(data, (d) => d.life_expectancy)).nice();

  xAxisG.call(d3.axisBottom(x));
  yAxisG.call(d3.axisLeft(y));

  const dotsGroup = g.append("g");

  const select = d3.select("#countrySelect");
  const slider = d3.select("#spendSlider");
  const spendValue = d3.select("#spendValue");

  // Slider max based on data
  const maxSpendData = d3.max(data, (d) => d.health_spending_gdp);
  const sliderMax = Math.ceil(maxSpendData * 10) / 10;
  slider.attr("max", sliderMax).property("value", sliderMax);
  spendValue.text(fmt(sliderMax, 1));

  // Populate dropdown
  select
    .selectAll("option.country")
    .data(data.map((d) => d.country).sort())
    .enter()
    .append("option")
    .attr("class", "country")
    .attr("value", (d) => d)
    .text((d) => d);

  function isVisible(d) {
    const maxSpend = +slider.node().value;
    return d.health_spending_gdp <= maxSpend;
  }

  function resetPinned() {
    pinnedCountry = "";
    select.property("value", "");
    d3.select("#detailsContent").html(`
      <p><strong>Country:</strong> —</p>
      <p><strong>Life expectancy:</strong> —</p>
      <p><strong>Health spending:</strong> —</p>
    `);
    applyHighlight();
    updateCountSummary();
  }

  // Click off to deselect (click on empty chart space)
  svg.on("click", (event) => {
    const tag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : "";
    if (tag !== "circle") resetPinned();
  });

  // Dots
  const dots = dotsGroup
    .selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", (d) => x(d.health_spending_gdp))
    .attr("cy", (d) => y(d.life_expectancy))
    .attr("r", 5)
    .attr("fill", "#4682b4")
    .attr("opacity", 0.9)
    .style("cursor", "pointer")
    .on("click", (event, d) => {
      event.stopPropagation();
      pinnedCountry = d.country;

      d3.select("#detailsContent").html(`
        <p><strong>Country:</strong> ${d.country}</p>
        <p><strong>Life expectancy:</strong> ${fmt(d.life_expectancy, 1)} years</p>
        <p><strong>Health spending:</strong> ${fmt(d.health_spending_gdp, 3)}% GDP</p>
      `);

      applyHighlight();
      updateCountSummary();
    })
    .on("mouseover", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(
          `<strong>${d.country}</strong><br/>
           Spending: ${fmt(d.health_spending_gdp, 3)}% GDP<br/>
           Life expectancy: ${fmt(d.life_expectancy, 1)} years`
        );
    })
    .on("mousemove", (event) => {
      tooltip.style("left", event.pageX + 12 + "px").style("top", event.pageY - 18 + "px");
    })
    .on("mouseout", () => tooltip.style("opacity", 0));

  function applyColour() {
    dots
      .transition()
      .duration(250)
      .attr("fill", (d) => (showColour ? colourScale(d.health_spending_gdp) : "#4682b4"));
  }

  function applyHighlight() {
    const dropdownCountry = select.node().value;
    const active = dropdownCountry || pinnedCountry;

    dots
      .transition()
      .duration(200)
      .attr("stroke", (d) => {
        if (!active) return "none";
        return d.country === active ? "#fff" : "none";
      })
      .attr("stroke-width", (d) => {
        if (!active) return 0;
        return d.country === active ? 2.5 : 0;
      })
      .attr("r", (d) => {
        if (!active) return 5;
        return d.country === active ? 8 : 5;
      })
      .style("opacity", (d) => {
        if (!isVisible(d)) return 0;
        if (!active) return 0.9;
        return d.country === active ? 1 : 0.25;
      })
      .style("filter", (d) => {
        if (!active) return "none";
        return d.country === active ? "drop-shadow(0 0 4px rgba(0,0,0,0.5))" : "none";
      });
  }

  function updateTrendline() {
    if (!showTrend) return;

    const filtered = data.filter(isVisible);
    if (filtered.length < 2) {
      trendline.transition().duration(200).style("opacity", 0);
      return;
    }

    const lr = linearRegression(filtered, (d) => d.health_spending_gdp, (d) => d.life_expectancy);
    const [xMin, xMax] = d3.extent(filtered, (d) => d.health_spending_gdp);

    trendline
      .attr("x1", x(xMin))
      .attr("y1", y(lr.predict(xMin)))
      .attr("x2", x(xMax))
      .attr("y2", y(lr.predict(xMax)))
      .transition()
      .duration(200)
      .style("opacity", 1);
  }

  function applyFilter() {
    const maxSpend = +slider.node().value;

    spendValue.text(fmt(maxSpend, 1));

    dots.interrupt();

    dots
      .style("display", (d) => (isVisible(d) ? null : "none"))
      .style("opacity", (d) => (isVisible(d) ? 0.9 : 0));

    // If selected country becomes hidden, clear selection
    const active = select.node().value || pinnedCountry;
    if (active) {
      const activeDatum = data.find((d) => d.country === active);
      if (activeDatum && !isVisible(activeDatum)) resetPinned();
      else applyHighlight();
    }

    updateTrendline();
  }

  // Brush summary
  function setBrushSummary(selected) {
    const summaryDiv = d3.select("#brushSummary");
    brushedCountries = selected || [];

    if (!selected || selected.length === 0) {
      summaryDiv.html(`
        <p><strong>Selected countries:</strong> —</p>
        <p><strong>Mean life expectancy:</strong> —</p>
        <p><strong>Mean spending:</strong> —</p>
        <p class="muted small">Tip: drag a rectangle over points in the chart.</p>
      `);
      updateCountSummary();
      return;
    }

    const meanLife = d3.mean(selected, (d) => d.life_expectancy);
    const meanSpend = d3.mean(selected, (d) => d.health_spending_gdp);

    const names = selected.map((d) => d.country).sort();
    const shown = names.slice(0, 8);
    const more = names.length > 8 ? ` (+${names.length - 8} more)` : "";

    summaryDiv.html(`
      <p><strong>Selected countries:</strong> ${shown.join(", ")}${more}</p>
      <p><strong>Mean life expectancy:</strong> ${fmt(meanLife, 2)} years</p>
      <p><strong>Mean spending:</strong> ${fmt(meanSpend, 3)}% GDP</p>
    `);
    updateCountSummary();
  }

  const brush = d3
    .brush()
    .extent([
      [0, 0],
      [width, height],
    ])
    .on("brush end", ({ selection }) => {
      if (!selection) {
        dots.transition().duration(120).style("opacity", (d) => (isVisible(d) ? 0.9 : 0));
        setBrushSummary([]);
        return;
      }

      const [[x0, y0], [x1, y1]] = selection;

      const selected = data.filter((d) => {
        if (!isVisible(d)) return false;
        const px = x(d.health_spending_gdp);
        const py = y(d.life_expectancy);
        return px >= x0 && px <= x1 && py >= y0 && py <= y1;
      });

      dots
        .transition()
        .duration(120)
        .style("opacity", (d) => {
          if (!isVisible(d)) return 0;
          const px = x(d.health_spending_gdp);
          const py = y(d.life_expectancy);
          const inBrush = px >= x0 && px <= x1 && py >= y0 && py <= y1;
          return inBrush ? 1 : 0.18;
        });

      setBrushSummary(selected);
    });

  brushLayer.call(brush);

  // Controls wiring
  select.on("change", () => applyHighlight());
  slider.on("input", applyFilter);
  slider.on("change", applyFilter);

  d3.select("#toggleColour").on("click", (event) => {
    event.preventDefault();
    showColour = !showColour;

    d3.select("#legend")
      .style("display", showColour ? "block" : "none")
      .attr("aria-hidden", showColour ? "false" : "true");

    applyColour();
  });

  d3.select("#toggleTrend").on("click", (event) => {
    event.preventDefault();
    showTrend = !showTrend;

    if (!showTrend) {
      trendline.transition().duration(200).style("opacity", 0);
      return;
    }
    updateTrendline();
  });

  function handleResize() {
    outerWidth = getChartOuterWidth();
    width = outerWidth - margin.left - margin.right;
    height = outerHeight - margin.top - margin.bottom;

    svg.attr("viewBox", `0 0 ${outerWidth} ${outerHeight}`);

    x.range([0, width]);
    y.range([height, 0]);

    xAxisG.attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
    yAxisG.call(d3.axisLeft(y));

    xLabel.attr("x", width / 2).attr("y", height + 55);
    yLabel.attr("x", -height / 2);

    dots.attr("cx", (d) => x(d.health_spending_gdp)).attr("cy", (d) => y(d.life_expectancy));

    brush.extent([
      [0, 0],
      [width, height],
    ]);
    brushLayer.call(brush);

    updateTrendline();
  }

  // Initial render
  applyFilter();
  applyHighlight();
  applyColour(); // ensures colour toggle state applies cleanly if changed quickly
  window.addEventListener("resize", handleResize);
});
