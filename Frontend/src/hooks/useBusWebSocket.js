import { useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

export default function useBusWebSocket(map) {
  const stompClientRef = useRef(null);
  const busMarkersRef = useRef({});

  useEffect(() => {
    if (!map?.current) return;

    const socket = new SockJS("http://gwon.my/ws");
    const client = new Client({
      webSocketFactory: () => socket,
      onConnect: () => {
        console.log("✅ WebSocket 연결됨");

        client.subscribe("/topic/data", (message) => {
          const data = JSON.parse(message.body);
          console.log("📥 실시간 수신:", data);

          const { id, lat, lng, name } = data;
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
              "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png",
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
      },
      onStompError: (frame) => {
        console.error("❌ STOMP 에러", frame);
      },
    });

    client.activate();
    stompClientRef.current = client;

    return () => {
      if (stompClientRef.current) {
        stompClientRef.current.deactivate();
      }
    };
  }, [map]);
}