import { APIProvider, Map } from "@vis.gl/react-google-maps";
import "./GoogleMapTest.css";

export default function GoogleMapTest() {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  if (!apiKey) {
    return (
      <div className="gmt-error">
        Missing VITE_GOOGLE_MAPS_API_KEY in your env
      </div>
    );
  }

  return (
    <div className="gmt-card">
      <div className="gmt-header">
        <h3>Map Preview</h3>
        <span className="gmt-badge">Google Maps</span>
      </div>

      <div className="gmt-map">
        <APIProvider apiKey={apiKey}>
          <Map
            defaultCenter={{ lat: 31.7683, lng: 35.2137 }} // Jerusalem
            defaultZoom={13}
            gestureHandling="greedy"
            disableDefaultUI={false}
          />
        </APIProvider>
      </div>
    </div>
  );
}
