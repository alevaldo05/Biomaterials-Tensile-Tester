# CSV and Excel downloads

Feature card. Update it in the same change as the feature.

## Purpose
Download data as CSV (opens in Excel), the numeric .xlsx file, and the graph as PNG or SVG.

## Files
- `live.js` (CSV on test pages)
- `graph.js` (CSV reading, PNG, SVG)
- `excel-export.js` (hand-written zip and XML)

## What the user sees
- Download CSV, Excel, PNG, SVG buttons

## Behavior to keep
- Files stay in base units whatever the display settings
- Excel is checked with openpyxl and LibreOffice, not Microsoft Excel
- Nothing is saved by the site

## Labels that must stay
- Source label in the file header (simulated, sample, measured)

## Depends on
- Graph engine

## How to check
- Compare the CSV header lines before and after a change
