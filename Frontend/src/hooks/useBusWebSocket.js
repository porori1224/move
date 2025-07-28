import { useEffect, useRef } from "react";
import { Stomp } from "@stomp/stompjs";
import SockJS from "sockjs-client";

export default function useBusWebSocket(map) {
  const stompClientRef = useRef(null);
  const busMarkersRef = useRef({});

  useEffect(() => {
    console.log("📡 useBusWebSocket hook 실행됨");
    if (!map?.current) {
      return;
    }

    // 환경에 따라 WebSocket 주소 자동 설정
    // 개발: ws://localhost:8080/ws
    // 배포: wss://gwon.my/ws
    const WS_URL = "http://221.142.148.73:8080/ws";
    const socket = new SockJS(WS_URL);
    const client = Stomp.over(socket);
    client.debug = (str) => {
      console.log(`[STOMP DEBUG] ${str}`);
    };

    const onConnect = () => {
      console.log("✅ WebSocket 연결됨");

      client.subscribe("/topic/gps", (message) => {
        try {
          const data = JSON.parse(message.body);
          console.log("📥 실시간 수신:", data);

          const parsed = Array.isArray(data) ? data : [data];

          parsed.forEach((item) => {
            const id = item.deviceId || item.deviceID || item.id || `unknown-${Math.random()}`;
            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lng || item.lon);
            const name = item.name || id;

            if (isNaN(lat) || isNaN(lng)) return;

            const position = new window.kakao.maps.LatLng(lat, lng);

            if (busMarkersRef.current[id]) {
              busMarkersRef.current[id].setPosition(position);
              const infowindow = new window.kakao.maps.InfoWindow({
                content: `<div style="padding:5px;">${name}</div>`,
              });
              infowindow.open(map.current, busMarkersRef.current[id]);
              setTimeout(() => {
                infowindow.close();
              }, 2000);
            } else {
              const markerImage = new window.kakao.maps.MarkerImage(
                "/markerStar.png",
                new window.kakao.maps.Size(24, 35)
              );

              const marker = new window.kakao.maps.Marker({
                position,
                map: map.current,
                title: name,
                image: markerImage,
              });

              const infowindow = new window.kakao.maps.InfoWindow({
                content: `<div style="padding:5px;">${name}</div>`,
              });

              window.kakao.maps.event.addListener(marker, "mouseover", () => {
                infowindow.open(map.current, marker);
              });
              window.kakao.maps.event.addListener(marker, "mouseout", () => {
                infowindow.close();
              });

              infowindow.open(map.current, marker);
              setTimeout(() => {
                infowindow.close();
              }, 2000);

              busMarkersRef.current[id] = marker;
            }
          });
        } catch (err) {
          console.error("❌ 메시지 파싱 오류:", err);
        }
      });
    };

    const onError = (error) => {
      console.error("❌ WebSocket 연결 실패:", error);
    };

    client.onConnect = onConnect;
    client.onStompError = onError;
    client.onWebSocketError = onError;
    client.activate();
    stompClientRef.current = client;

    return () => {
      if (stompClientRef.current) {
        stompClientRef.current.disconnect(() => {
          console.warn("🔌 WebSocket 연결 종료됨");
        });
      }
    };
  }, [map]);
}