# AirGuide MVP

Compare routes based on travel time and air pollution exposure. Find the cleanest path to your destination.

<img width="1918" height="865" alt="image" src="https://github.com/user-attachments/assets/98bb63a5-a00b-48f5-892d-b5e7f1566fa7" />


## Features

- **Route Comparison**: Fetch 2-3 alternative routes using Google Maps Directions API
- **Pollution Analysis**: Sample AQI data along each route using Google Air Quality API
- **Exposure Score**: Calculate pollution exposure based on AQI × time spent
- **Visual Results**: Clean dark UI with glassmorphism cards
- **Interactive Map**: See routes drawn with color coding (Red = Fastest, Green = Cleanest)

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Google Maps JavaScript SDK + Directions API
- Google Air Quality API
- @mapbox/polyline

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Add your API keys to `.env.local`:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
GOOGLE_AIR_QUALITY_API_KEY=your_air_quality_api_key
```

### 3. Enable Google Cloud APIs

In Google Cloud Console, enable these APIs:
- Maps JavaScript API
- Directions API
- Places API
- Geocoding API
- Air Quality API

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

1. Enter a start location in the first input
2. Enter a destination in the second input
3. Click "Find Routes"
4. View route comparison cards showing:
   - Travel time
   - Average AQI
   - Exposure score
   - Winner badge
5. View routes on the interactive map

## Project Structure

```
/app
  /page.tsx          # Main page with route finder
  /layout.tsx        # Root layout
  /globals.css       # Global styles
/components
  /Map.tsx           # Google Maps component
  /RouteCard.tsx     # Route comparison card
/lib
  /getRoutes.ts      # Directions API integration
  /decodePolyline.ts # Polyline decoding utilities
  /getAQI.ts         # Air Quality API integration
  /calculateExposure.ts # Exposure score calculation
/types
  /polyline.d.ts     # Type declarations
```

## API Keys Setup

### Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or select existing
3. Enable "Maps JavaScript API", "Directions API", "Places API", "Geocoding API"
4. Go to Credentials and create an API Key
5. (Optional) Add HTTP referrer restrictions for security

### Air Quality API Key

1. In Google Cloud Console, enable "Air Quality API"
2. Use the same API key or create a separate one
3. Note: Air Quality API has separate billing

## Performance

- AQI API calls limited to 20 points per route
- Parallel API calls using Promise.all
- In-memory caching for AQI results (10 min TTL)
- In-memory caching for route results (5 min TTL)

## AQI Categories

| AQI Range | Category | Color |
|-----------|----------|-------|
| 0-50 | Good | Green |
| 51-100 | Moderate | Yellow |
| 101-150 | Unhealthy for Sensitive Groups | Orange |
| 151-200 | Unhealthy | Red |
| 201-300 | Very Unhealthy | Purple |
| 301+ | Hazardous | Maroon |

## License

MIT
