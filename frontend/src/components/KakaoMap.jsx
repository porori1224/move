import React, { useEffect, useRef } from "react";


const MapContainer = ({ busData }) => {
    const mapContainer = useRef(null);
    const map = useRef(null);

    useEffect(() => {
      const scriptId = "kakao-map-sdk";
      const appKey = import.meta.env.VITE_KAKAO_MAP_APP_KEY;

      const onSdkReady = () => {
        // kakao.maps.load는 SDK가 이미 로드된 경우 즉시 콜백을 실행
        if (window.kakao && window.kakao.maps && typeof window.kakao.maps.load === 'function') {
          window.kakao.maps.load(initializeMap);
        } else {
          console.error("❌ Kakao SDK present but load() is unavailable");
        }
      };

      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        console.log("📌 SDK already loaded or present, ensuring load() before init");
        onSdkReady();
        return;
      }

      const script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`;
      script.async = true;
      script.onerror = () => {
        console.error("❌ Failed to load Kakao Maps script");
      };
      script.onload = () => {
        console.log("✅ Kakao Maps script loaded");
        onSdkReady();
      };
      document.head.appendChild(script);

      function initializeMap() {
        console.log("✅ Initializing Kakao Map");
        const container = mapContainer.current;
        if (!container) {
          console.error("❌ Map container is null");
          return;
        }
        const options = {
          center: new window.kakao.maps.LatLng(35.140876, 126.930593),
          level: 3,
        };
        map.current = new window.kakao.maps.Map(container, options);
        console.log("✅ Kakao map initialized:", map.current);
      }
    }, []);


    useEffect(() => {
      if (!map.current || !busData) return;

      busData.forEach(({ id, lng, lat, name }) => {
        const markerPosition = new window.kakao.maps.LatLng(lat, lng);
        const marker = new window.kakao.maps.Marker({
          position: markerPosition,
          map: map.current,
        });
        const infowindow = new window.kakao.maps.InfoWindow({
          content: `<div style="padding:5px;">${name}</div>`,
        });
        window.kakao.maps.event.addListener(marker, 'mouseover', () => {
          infowindow.open(map.current, marker);
        });
        window.kakao.maps.event.addListener(marker, 'mouseout', () => {
          infowindow.close();
        });
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
        ></div>
  );
};

export default MapContainer;
