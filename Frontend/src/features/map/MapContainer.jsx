import React, { useEffect, useRef, useState } from "react";
import SearchBox from "./components/SearchBox";
import useBusRoute from "../../hooks/useBusRoute";
import useCoordinateLogger from "../../hooks/useCorrdinateLogger";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";

const MapContainer = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [searchResult, setSearchResult] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [busData, setBusData] = useState([]);

  useCoordinateLogger(map);
  useBusRoute(map);

  function setupWebSocket() {
    if (!map.current) return;
    console.log("📡 WebSocket 연결 시도");
    const socket = new SockJS("http://221.142.148.73:8080/ws");
    const client = Stomp.over(socket);
    client.debug = (str) => console.log(`[STOMP DEBUG] ${str}`);
    client.reconnectDelay = 5000;

    client.onConnect = () => {
      console.log("✅ WebSocket 연결됨");

      client.subscribe("/topic/gps", (message) => {
        const data = JSON.parse(message.body);
        const parsedData = Array.isArray(data) ? data : [data];
        const formattedData = parsedData.map((item, index) => {
          const deviceIdMatch = item.deviceId || item.deviceID || item.device_id || `device-${index}`;
          return {
            id: deviceIdMatch,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon || item.lng),
            name: deviceIdMatch,
          };
        });
        setBusData(formattedData);
      });
    };

    client.onStompError = (frame) => {
      console.error("❌ STOMP 프로토콜 오류:", frame);
    };

    client.onWebSocketError = (error) => {
      console.error("🌐 WebSocket 오류:", error);
    };

    client.activate();
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
      console.error("❌ 카카오 지도 스크립트 로드 실패");
    };
    script.onload = () => {
      console.log("✅ 카카오 지도 스크립트 로드 완료");
      window.kakao.maps.load(initializeMap);
    };
    document.head.appendChild(script);

    function initializeMap() {
      const container = mapContainer.current;
      if (!container) {
        return;
      }
      const options = {
        center: new window.kakao.maps.LatLng(35.140876, 126.930593),
        level: 3,
      };
      map.current = new window.kakao.maps.Map(container, options);
      console.log("✅ 카카오 지도 초기화 완료:", map.current);
      setMapReady(true);

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

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const userLatLng = new window.kakao.maps.LatLng(latitude, longitude);

            const userMarker = new window.kakao.maps.Marker({
              position: userLatLng,
              map: map.current,
              image: new window.kakao.maps.MarkerImage(
                "/markerStar.png",
                new window.kakao.maps.Size(24, 35)
              ),
            });

            map.current.setCenter(userLatLng);

            window.kakao.maps.event.addListener(map.current, 'click', function (mouseEvent) {
              const latlng = mouseEvent.latLng;
              const lat = latlng.getLat();
              const lng = latlng.getLng();
              alert(`📍 위도: ${lat}\n경도: ${lng}`);
            });

            setMapReady(true);
          },
          (error) => {
            console.warn("⚠️ 위치 정보를 가져오지 못했습니다. 기본 위치로 설정합니다.");
            const fallbackLatLng = new window.kakao.maps.LatLng(35.140876, 126.930593);
            map.current.setCenter(fallbackLatLng);

            new window.kakao.maps.Marker({
              position: fallbackLatLng,
              map: map.current,
              title: "기본 위치",
            });

            setMapReady(true);
          }
        );
      } else {
        console.warn("⚠️ 이 브라우저는 위치 정보를 지원하지 않습니다.");
        const fallbackLatLng = new window.kakao.maps.LatLng(35.140876, 126.930593);
        map.current.setCenter(fallbackLatLng);
        setMapReady(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!map.current || !busData) return;

    busData.forEach(({ id, lng, lat, name }) => {
      const markerPosition = new window.kakao.maps.LatLng(lat, lng);
      const markerImage = new window.kakao.maps.MarkerImage(
        "/busMarker.png",
        new window.kakao.maps.Size(24, 35)
      );

      const marker = new window.kakao.maps.Marker({
        position: markerPosition,
        map: map.current,
        title: name,
        image: markerImage,
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
