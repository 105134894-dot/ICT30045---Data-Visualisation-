import pandas as pd
from pathlib import Path

life_path = Path("data/life.csv")
spend_path = Path("data/spend.csv")

# Your files have 2 metadata lines, then a real CSV header:
# 1: "Life expectancy at birth"
# 2: "Total, Number of years, 2022"
# 3: "Category","Life expectancy at birth"
SKIPROWS = 2

life_raw = pd.read_csv(life_path, skiprows=SKIPROWS)
spend_raw = pd.read_csv(spend_path, skiprows=SKIPROWS)

print("Life columns:", list(life_raw.columns))
print("Spend columns:", list(spend_raw.columns))

# Column 0 = country (Category), Column 1 = value
life = life_raw[[life_raw.columns[0], life_raw.columns[1]]].copy()
spend = spend_raw[[spend_raw.columns[0], spend_raw.columns[1]]].copy()

life.columns = ["country", "life_expectancy"]
spend.columns = ["country", "health_spending_gdp"]

# Clean and coerce numeric
life["country"] = life["country"].astype(str).str.strip().str.strip('"')
spend["country"] = spend["country"].astype(str).str.strip().str.strip('"')

life["life_expectancy"] = pd.to_numeric(life["life_expectancy"], errors="coerce")
spend["health_spending_gdp"] = pd.to_numeric(spend["health_spending_gdp"], errors="coerce")

merged = pd.merge(life, spend, on="country", how="inner").dropna()

out_path = Path("data/merged.csv")
merged.to_csv(out_path, index=False)

print(f"✅ Wrote {out_path} with {len(merged)} rows")
print(merged.head(10).to_string(index=False))
