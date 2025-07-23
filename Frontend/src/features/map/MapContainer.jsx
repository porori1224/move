import React, { useEffect, useRef, useState } from "react";
import { mockBusData } from "../../features/bus/mockBusData";
import SearchBox from "./components/SearchBox";
import useBusRoute from "../../hooks/useBusRoute";
import useCoordinateLogger from "../../hooks/useCorrdinateLogger";
import { use } from "react";

const MapContainer = ({ busData = mockBusData }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [searchResult, setSearchResult] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  useCoordinateLogger(map);
  useBusRoute(map);
  // useBusWebSocket(map); 호출을 아래 useEffect로 이동

  // WebSocket 연결을 설정하는 내부 함수 (기존 useBusWebSocket 역할)
  function setupWebSocket() {
    // useBusWebSocket에서 수행할 로직 예시
    // 실제 hook 구현에 맞게 WebSocket 주소와 로직을 조정하세요.
    if (!map.current) return;
    // 기본 예시입니다. ws 인스턴스를 저장하거나 정리 작업이 필요할 수 있습니다.
    const ws = new window.WebSocket("ws://localhost:8080/ws/bus");
    ws.onopen = () => {
      console.log("🚌 웹소켓 연결됨");
      // 초기 메시지를 보낼 수 있습니다 (옵션)
      // ws.send(JSON.stringify({ type: "subscribe", mapId: ... }));
    };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // 수신된 버스 데이터를 처리하고 지도 마커를 업데이트합니다.
      console.log("🚌 수신된 버스 데이터:", data);
      // 마커를 업데이트하려면 여기에 로직을 추가할 수 있습니다.
      // 메모리 누수에 주의해야 하며, 이전 마커는 필요 시 정리해야 합니다.
    };
    ws.onerror = (error) => {
      console.error("❌ 웹소켓 오류:", error);
    };
    ws.onclose = () => {
      console.log("🚌 웹소켓 연결 종료됨");
    };
    // 나중에 정리를 위해 ws를 ref에 저장할 수 있습니다 (옵션)
  }

  useEffect(() => {
    if (mapReady && map.current) {
      setupWebSocket();
    }
  }, [mapReady]);

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

          // 지도 클릭 시 위도/경도 출력
          window.kakao.maps.event.addListener(map.current, 'click', function (mouseEvent) {
            const latlng = mouseEvent.latLng;
            const lat = latlng.getLat();
            const lng = latlng.getLng();
            alert(`📍 위도: ${lat}\n경도: ${lng}`);
            console.log(`🗺️ 클릭된 위치: 위도 ${lat}, 경도 ${lng}`);
          });
          setMapReady(true);
        },
        (error) => {
          alert("사용자 위치를 가져오는 데 실패했습니다. 위치 권한을 확인해주세요.");
          console.error("❌ 사용자 위치 가져오기 실패:", error);
          setMapReady(true);
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
