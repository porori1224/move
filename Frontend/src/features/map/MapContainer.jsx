import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = 'pk.eyJ1IjoibWluc2VvMTIyNCIsImEiOiJjbWJzNmNpMzUwaDRxMmtxMndvb21iNmttIn0.sWARvE-o7UsazaSfeoEGmg';

const MapContainer = ({ busData }) => {
    const mapContainer = useRef(null);
    const map = useRef(null);

    useEffect (() => {
        if (map.current) return;

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/streets-v11',
            center: [126.930593, 35.140876], // 조선대학교 본관 위치 설정
            zoom: 16,
        });
        map.current.on('load', () => {
          const layers = map.current.getStyle().layers;
          for (const layer of layers) {
            if (layer.type === 'symbol' && layer.layout?.['text-field']) {
              map.current.setLayoutProperty(layer.id, 'text-field', [
                'coalesce',
                ['get', 'name_ko'],
                ['get', 'name']
              ]);
            }
          }
        });
    }, []);

    useEffect(() => {
        if (!map.current || !busData) return;

        busData.forEach(({ id, lng, lat, name }) => {
            const el = document.createElement('div');
            el.className = 'marker';

            new mapboxgl.Marker(el)
                .setLngLat([lng, lat])
                .setPopup(new mapboxgl.Popup().setHTML(`<strong>${name}</strong>`))
                .addTo(map.current);
        });
    }, [busData]);

    return (
        <div
          ref={mapContainer}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
          }}
        />
  );
};

export default MapContainer;
