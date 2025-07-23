import React, { useEffect, useRef, useState } from "react";
import { mockBusData } from "../../features/bus/mockBusData";
import SearchBox from "./components/SearchBox";

const MapContainer = ({ busData = mockBusData }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [searchResult, setSearchResult] = useState(null);

  useEffect(() => {
    const scriptId = "kakao-map-sdk";

    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      console.log("📌 SDK already loaded, proceeding to init");
      if (window.kakao && window.kakao.maps) {
        initializeMap();
      } else {
        existingScript.onload = initializeMap;
      }
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://dapi.kakao.com/v2/maps/sdk.js?appkey=7edbe84100355d940cf66090dbd7ea05&libraries=services&autoload=false";
    script.async = true;
    script.onerror = () => {
      console.error("❌ Failed to load Kakao Maps script");
    };
    script.onload = () => {
      console.log("✅ Kakao Maps script loaded");
      window.kakao.maps.load(initializeMap);
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

      if (searchResult) {
        const { lat, lng, name } = searchResult;
        const position = new window.kakao.maps.LatLng(lat, lng);

        map.current.setCenter(position);

        new window.kakao.maps.Marker({
          position,
          map: map.current,
          title: name,
        });
      }

      // 사용자 위치 가져오기 및 마커
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const userLatLng = new window.kakao.maps.LatLng(latitude, longitude);

          // 사용자 위치 마커
          const userMarker = new window.kakao.maps.Marker({
            position: userLatLng,
            map: map.current,
            image: new window.kakao.maps.MarkerImage(
              'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png',
              new window.kakao.maps.Size(24, 35)
            ),
          });

          // 지도 중심을 사용자 위치로 이동
          map.current.setCenter(userLatLng);
        },
        (error) => {
          alert("사용자 위치를 가져오는 데 실패했습니다. 위치 권한을 확인해주세요.");
          console.error("❌ 사용자 위치 가져오기 실패:", error);
        }
      );
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

  useEffect(() => {
    if (!map.current || !searchResult) return;
    const { lat, lng, name } = searchResult;
    const position = new window.kakao.maps.LatLng(lat, lng);
    map.current.setCenter(position);
    new window.kakao.maps.Marker({
      position,
      map: map.current,
      title: name,
    });
  }, [searchResult]);

  return (
    <>
    <SearchBox onSearch={setSearchResult} />
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
    </>
  );
};

export default MapContainer;
