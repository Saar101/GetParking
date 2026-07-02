# GetParking

Smart parking discovery and management platform built with React, TypeScript, Firebase, Google Maps, and an Express-based AI recommendation API.

GetParking serves three product surfaces in a single application:

- Customer experience for discovering nearby parking, comparing pricing, booking spaces, saving favorites, and asking the AI assistant for guidance.
- Parking owner experience for monitoring owned lots, managing pricing, and syncing parking-space inventory from structured JSON files.
- Admin experience for operating the full system, managing users and lot ownership, monitoring activity, and maintaining parking inventory across all lots.

## Highlights

- Role-based application flow for `customer`, `owner`, and `admin` users.
- Firebase Authentication and Firestore-backed data model.
- Interactive map search powered by Google Maps.
- AI parking recommendation workflow with follow-up chat support.
- Real-time and operational admin tooling for lots, users, and activity.
- Parking-space JSON sync with `merge` or `replace` behavior.
- Support for imported Israeli government parking lots with coordinate conversion.

## Product Capabilities

### Customer

- Search for parking lots around a selected map location.
- Review pricing tiers, promotions, availability, distance, and recommendations.
- Book the first available parking space in a lot.
- Save favorite lots and reopen them quickly.
- Open navigation to a lot in Waze or Google Maps.
- Ask the AI assistant for the most suitable parking option and continue the conversation with follow-up questions.

### Parking Owner

- View owned lots and their occupancy breakdown.
- Inspect lot-specific parking spaces and manually update statuses.
- Review reservation and occupied-customer details.
- Configure base pricing and sale pricing per lot.
- Sync parking-space inventory for owned lots from JSON files.

### Admin

- Create users and lots.
- Disable, re-enable, and promote users.
- Assign and unassign owners to parking lots.
- Delete lots with confirmation and searchable lot selection.
- Manage all lots through a dedicated parking-management popup.
- Sync lot parking spaces from JSON files across the system.
- Monitor user activity and operational metrics.
- Edit personal admin account settings.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| Maps | `@vis.gl/react-google-maps` |
| Backend API | Express |
| Database | Firebase Firestore |
| Authentication | Firebase Authentication |
| AI Integration | OpenAI-compatible chat completion flow |
| Coordinate Conversion | `proj4` |
| Tooling | ESLint, SWC, Nodemon |

## Repository Structure

```text
src/
  components/
    AdminMainScreen/
    AdminParkingManagementPopup/
    AdminSystemActivityPopup/
    AdminUserManagementPopup/
    ChatConsultation/
    CustomerMainScreen/
    FavoritesTable/
    GoogleMapTest.tsx/
    OwnerLotsPopup/
    OwnerMainScreen/
    OwnerPricingPopup/
    ParkingInfo/
    ParkingReservation/
    UserSettings/
  services/
    parkingLots.service.ts
    parkingSpaces.service.ts
    seed.ts
    users.service.ts
server/
  index.js
  routes/
  services/
```

## Local Development

### Prerequisites

- Node.js 20+ recommended.
- npm.
- A Firebase project configured for Authentication and Firestore.
- A Google Maps API key configured for the map experience.
- An OpenAI API key if you want AI recommendations and follow-up chat to work.

### Installation

```bash
npm install
```

### Run the Frontend

```bash
npm run dev
```

The Vite client runs locally with `/api` proxied to the recommendation server.

### Run the Recommendation API

```bash
npm run dev:server
```

By default, the Express API listens on port `5176`.

### Production Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Environment and Configuration

### Frontend

The client can use an explicit API base URL if needed:

```bash
VITE_PARKING_API_BASE_URL=http://localhost:5176
```

If this variable is not set, the app uses Vite proxying and local fallback URLs.

### Server

Supported server-side environment variables:

```bash
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini
PARKING_API_PORT=5176
```

### Firebase

The project currently initializes Firebase in `src/firebase.ts`. For production or open-source distribution, move project-specific Firebase configuration into environment variables or deployment secrets according to your security and deployment model.

## AI Recommendation API

The Express server exposes two endpoints:

- `POST /api/parking-recommendation`
- `POST /api/parking-recommendation-followup`

Behavior summary:

- The first endpoint ranks or recommends a parking lot using OpenAI when available.
- The second endpoint continues the conversation only when the original recommendation came from the OpenAI path.
- If the OpenAI path is unavailable, the system falls back to a local explanation path where possible.

## Parking-Space Sync Format

Parking-space sync expects a JSON structure organized by lot, floors, sections, and spots. The sync layer flattens this structure and writes parking-space documents into Firestore.

High-level structure:

```json
{
  "parkingLot": {
    "id": "lot-id",
    "liveAvailability": {
      "dataSource": "provider-name"
    },
    "floors": [
      {
        "floorId": "F1",
        "name": "Floor 1",
        "sections": [
          {
            "sectionId": "A",
            "name": "Section A",
            "spots": [
              {
                "spotId": "A1",
                "type": "regular",
                "status": "available"
              }
            ]
          }
        ]
      }
    ]
  }
}
```

Supported sync modes:

- `Merge`: creates or updates imported spaces and leaves unmatched existing spaces untouched.
- `Replace`: creates or updates imported spaces and deletes unmatched spaces in the selected lot.

## Imported Government Lots

The project includes support for importing official Israeli parking-lot data and converting coordinates from ITM to WGS84.

Design notes:

- Imported government lots can be shown to customers even when price data is not known.
- Unknown pricing is intentionally handled differently in the UI and AI recommendation layer.
- Navigation uses coordinates when available for more accurate routing.

## Known Operational Notes

- The frontend dev server and the Express API must run on separate ports.
- Follow-up AI chat depends on the recommendation server being available and properly configured with `OPENAI_API_KEY`.
- Firebase project setup is required before authentication, booking, and admin workflows will operate correctly.

## Suggested Setup Checklist

1. Install dependencies with `npm install`.
2. Configure Firebase for Auth and Firestore.
3. Configure `OPENAI_API_KEY` for the server.
4. Start the API with `npm run dev:server`.
5. Start the frontend with `npm run dev`.
6. Open the app and test login, map search, and role-based flows.


## License

No license file is currently defined in this repository.
