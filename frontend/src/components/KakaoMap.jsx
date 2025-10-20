// Kakao 지도를 초기화/표시하고, 현재 위치(정확도 원 + 방향 오버레이)와
// 외부에서 전달되는 버스 마커를 그리는 컴포넌트입니다.
import React, { useCallback, useEffect, useRef, useState } from "react";
import styles from './KakaoMap.module.css';
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import updateBusMarkers, { FALLBACK_ORG, stopAllAnimations, orgKeyFromSelection } from './map/busMarkerManager'

const INITIAL_POSITION = { lat: 35.140876, lng: 126.930593 };
const getDefaultBus = () => ({
  id: 'placeholder-bus',
  lat: INITIAL_POSITION.lat,
  lng: INITIAL_POSITION.lng,
  name: '임시 운행 버스',
  speed: 0,
  updatedAt: Date.now(),
  org: FALLBACK_ORG,
  operatorId: null,
});

const MAP_FOLLOW_EPSILON = 0.00005;
const MAP_PAN_INTERVAL = 140;

const resolveBusKey = (item = {}) => {
  const orgToken =
    (typeof item.operatorName === 'string' && item.operatorName.trim().toLowerCase()) ||
    (typeof item.operation === 'string' && item.operation.trim().toLowerCase()) ||
    'unknown'
  const opIdToken = Number.isFinite(Number(item.operatorId)) ? `op-${Number(item.operatorId)}` : null
  const baseIdToken =
    item.id ?? item.busId ?? item.vehicleId ?? item.plateNumber ?? item.uniqueId ?? item.gpsId
  const finalId = [orgToken, opIdToken, baseIdToken].filter(Boolean).join(':')
  return finalId || `${orgToken}:no-id`
}

const MapContainer = ({ busData, num, selectedOrg, selectedBusFilter }) => {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const [data, setData] = useState([getDefaultBus()]);
    const [mapReady, setMapReady] = useState(false);
    const busMarkersRef = useRef(new Map());
    const busMarkerImageRef = useRef(null);
    const busOverlaysRef = useRef(new Map());
    const busMetaRef = useRef(new Map());
    const lastFollowedRef = useRef({ id: null, lat: null, lng: null });
    const followBusIdRef = useRef(null);
    const lastPanAtRef = useRef(0);
    const latestBusMapRef = useRef(new Map());
    const manualOverrideRef = useRef({ until: 0, reason: null });
    const prevBusFilterRef = useRef(selectedBusFilter);
    const prevOrgRef = useRef(selectedOrg);
    const registerManualOverride = useCallback((reason, duration = Infinity) => {
      const now = typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
      const until = duration === Infinity ? Infinity : now + Math.max(0, duration);
      manualOverrideRef.current = {
        until,
        reason: reason || 'manual',
      };
      followBusIdRef.current = null;
      lastFollowedRef.current = { id: null, lat: null, lng: null };
    }, []);

    const mergeIncomingBuses = useCallback((list) => {
      if (!Array.isArray(list) || !list.length) return;
      const mapRef = latestBusMapRef.current;
      const nextMap = new Map(mapRef);
      list.forEach((item) => {
        if (!item) return;
        const key = resolveBusKey(item);
        nextMap.set(key, { ...(nextMap.get(key) ?? {}), ...item });
      });
      latestBusMapRef.current = nextMap;
      setData(Array.from(nextMap.values()));
    }, []);

    useEffect(() => {
      window.__notifyManualMapInteraction = (payload) => {
        if (!payload || typeof payload !== 'object') {
          registerManualOverride('external');
          return;
        }
        const duration = Number.isFinite(payload.duration) ? payload.duration : undefined;
        registerManualOverride(payload.reason, duration);
      };

      return () => {
        if (window.__notifyManualMapInteraction) {
          delete window.__notifyManualMapInteraction;
        }
      };
    }, [registerManualOverride]);

    useEffect(() => {
      const orgChanged = prevOrgRef.current !== selectedOrg;
      const busChanged = prevBusFilterRef.current !== selectedBusFilter;
      if (orgChanged || busChanged) {
        manualOverrideRef.current = { until: 0, reason: null };
        prevOrgRef.current = selectedOrg;
        prevBusFilterRef.current = selectedBusFilter;
      }
    }, [selectedOrg, selectedBusFilter]);

    useEffect(() => {
      const rawWsUrl = import.meta.env.VITE_WS_URL || '';
      const gpsTopic = import.meta.env.VITE_GPS_TOPIC || '/move/gps/operator/1';
      const wsEndpoint = (() => {
        if (!rawWsUrl) return '';
        if (typeof window === 'undefined') return rawWsUrl;
        const isSecurePage = window.location?.protocol === 'https:';
        if (isSecurePage && rawWsUrl.startsWith('http://')) {
          return rawWsUrl.replace(/^http:/, 'https:');
        }
        return rawWsUrl;
      })();

      if (!wsEndpoint) {
        console.warn('SockJS endpoint가 설정되지 않았습니다. VITE_WS_URL을 확인하세요.');
        return () => undefined;
      }

      console.log('🌐 Using SockJS endpoint:', wsEndpoint);

      // SockJS endpoint - TODO: 추후 도메인으로 변경 예정 env 추가 
      const socket = new SockJS(wsEndpoint);

      // STOMP client
      const client = new Client({
        webSocketFactory: () => socket,
        reconnectDelay: 5000,
      });

      client.onConnect = () => {
        console.log("✅ Connected to WebSocket server");
        console.log('📌 Subscribing to topic:', gpsTopic);

        client.subscribe(gpsTopic, (message) => {
          try {
            const body = JSON.parse(message.body);
            console.log("📡 Received data:", body); // 개발자 도구에 출력
            const list = Array.isArray(body) ? body : [body];
            if (list.length) {
              mergeIncomingBuses(list);
            }
          } catch (error) {
            console.error('버스 데이터 파싱 실패', error);
          }
        });
      };

      client.onStompError = (frame) => {
        console.error("❌ STOMP error:", frame);
      };
      client.onWebSocketClose = (evt) => {
        console.warn('⚠️ SockJS connection closed', evt);
      };

      client.activate();

      return () => client.deactivate();
    }, [num, mergeIncomingBuses]);

  // SDK 로드 및 지도 초기화
    useEffect(() => {
      const scriptId = "kakao-map-sdk";
      const appKey = import.meta.env.VITE_KAKAO_MAP_APP_KEY;

      const onSdkReady = () => {
        if (window.kakao && window.kakao.maps && typeof window.kakao.maps.load === 'function') {
          window.kakao.maps.load(initializeMap);
        } else {
          console.error("❌ Kakao SDK present but load() is unavailable");
        }
      };

      let canceled = false;

      const handleScriptLoad = () => {
        if (canceled) return;
        const scriptEl = document.getElementById(scriptId);
        if (scriptEl) scriptEl.dataset.loaded = 'true';
        console.log("✅ Kakao Maps script loaded");
        onSdkReady();
      };

      let cleanupTarget = null;

      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        console.log("📌 SDK already loaded or present, ensuring load() before init");
        if (
          existingScript.dataset.loaded === 'true' ||
          (window.kakao && window.kakao.maps && typeof window.kakao.maps.load === 'function')
        ) {
          onSdkReady();
        } else {
          cleanupTarget = existingScript;
          existingScript.addEventListener('load', handleScriptLoad);
        }
      } else {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`;
        script.async = true;
        script.onerror = () => {
          console.error("❌ Failed to load Kakao Maps script");
        };
        cleanupTarget = script;
        script.addEventListener('load', handleScriptLoad);
        document.head.appendChild(script);
      }

      // 실제 지도 객체를 생성하고 전역(window.__kakaoMap)에 노출
      function initializeMap() {
        console.log("✅ Initializing Kakao Map");
        const container = mapContainer.current;
        if (!container) {
          console.error("❌ Map container is null");
          return;
        }
        const options = {
          center: new window.kakao.maps.LatLng(INITIAL_POSITION.lat, INITIAL_POSITION.lng),
          level: 3,
        };
        map.current = new window.kakao.maps.Map(container, options);
        setMapReady(true);
        // 전역으로 맵 인스턴스 노출 (간단한 컴포넌트 간 연동용)
        window.__kakaoMap = map.current;
        console.log("✅ Kakao map initialized:", map.current);

        try {
          busMarkerImageRef.current = new window.kakao.maps.MarkerImage(
            '/busmarker.svg',
            new window.kakao.maps.Size(42, 42),
            { offset: new window.kakao.maps.Point(21, 36) }
          );
        } catch (error) {
          console.warn('버스 마커 이미지를 생성하지 못했습니다.', error);
        }

        // 사용자 아이콘 이미지와 회전 마커 이미지 생성 유틸리티 준비
        const userIconImg = new Image();
        userIconImg.src = '/marker/user.svg';
        userIconImg.crossOrigin = 'anonymous';
        userIconImg.onload = () => {
          try {
            const deg = window.__headingDeg ?? 0;
            if (window.__myLocationMarker) {
              window.__myLocationMarker.setImage(makeRotatedMarkerImage(deg));
            }
          } catch {}
        };

        function makeRotatedMarkerImage(angleDeg = 0) {
          const dim = 40; // 캔버스 크기(여백 포함)
          const drawSize = 40; // 실제 아이콘 렌더링 크기
          const canvas = document.createElement('canvas');
          canvas.width = dim; canvas.height = dim;
          const ctx = canvas.getContext('2d');
          ctx.translate(dim / 2, dim / 2);
          // 아이콘 기본 방향(오른쪽)을 북쪽 기준(위쪽)으로 맞추기 위해 -90도 오프셋 적용
          const rotated = (angleDeg - 90) * Math.PI / 180;
          ctx.rotate(rotated);
          try { ctx.drawImage(userIconImg, -drawSize / 2, -drawSize / 2, drawSize, drawSize); } catch {}
          const url = canvas.toDataURL('image/png');
          return new window.kakao.maps.MarkerImage(
            url,
            new window.kakao.maps.Size(dim, dim),
            { offset: new window.kakao.maps.Point(dim / 2, dim / 2) }
          );
        }

        // ===== 현재 위치 표시 + 방향(heading) 오버레이 =====
        const createOrUpdateMyLocation = ({ latitude, longitude, accuracy, heading }) => {
          const myPos = new window.kakao.maps.LatLng(latitude, longitude);

          // 회전 가능한 사용자 아이콘 마커 생성/업데이트
          const angle = Number.isFinite(heading) ? heading : (window.__headingDeg ?? 0);
          if (!window.__myLocationMarker || typeof window.__myLocationMarker.setImage !== 'function') {
            window.__myLocationMarker = new window.kakao.maps.Marker({
              position: myPos,
              map: map.current,
              image: makeRotatedMarkerImage(angle),
              zIndex: 6,
              title: '내 위치',
            });
          } else {
            window.__myLocationMarker.setPosition(myPos);
            try { window.__myLocationMarker.setImage(makeRotatedMarkerImage(angle)); } catch {}
          }
          // 기존 정확도 원 제거(다시 그리기 위함)
          if (window.__myLocationCircle) window.__myLocationCircle.setMap(null);

          // 정확도 원 (GPS 정확도에 비례한 반투명 원)
          try {
            const circle = new window.kakao.maps.Circle({
              center: myPos,
              radius: Math.min(Math.max(accuracy || 50, 30), 200),
              strokeWeight: 1,
              strokeColor: '#1d4ed8',
              strokeOpacity: 0.7,
              strokeStyle: 'solid',
              fillColor: '#3b82f6',
              fillOpacity: 0.15,
            });
            circle.setMap(map.current);
            window.__myLocationCircle = circle;
          } catch (e) {
            console.warn('Circle overlay not created', e);
          }

          // 오버레이 대신 마커 이미지 회전으로 방향 표현
          const deg = Number.isFinite(heading) ? heading : (window.__headingDeg ?? 0);
          try { window.__myLocationMarker?.setImage(makeRotatedMarkerImage(deg)); } catch {}

          // 지도 중심/레벨 조정 (최초 호출 시에만)
          const isFollowingBus = followBusIdRef.current !== null;
          if (!window.__myLocationInitialized) {
            if (!isFollowingBus) {
              map.current.setCenter(myPos);
              if (typeof map.current.setLevel === 'function') map.current.setLevel(3);
            }
            window.__myLocationInitialized = true;
          }
        };

        // 위치 한 번 획득 후, watchPosition으로 지속 추적
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude, accuracy, heading } = pos.coords;
              createOrUpdateMyLocation({ latitude, longitude, accuracy, heading });
            },
            (err) => console.warn('Geolocation failed or denied', err),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );

          try {
            const watchId = navigator.geolocation.watchPosition(
              (pos) => {
                const { latitude, longitude, accuracy, heading } = pos.coords;
                createOrUpdateMyLocation({ latitude, longitude, accuracy, heading });
              },
              (err) => console.warn('watchPosition error', err),
              { enableHighAccuracy: true, maximumAge: 0 }
            );
            window.__geoWatchId = watchId;
          } catch (e) {
            console.warn('watchPosition not started', e);
          }
        } else {
          console.warn('Geolocation is not supported by this browser.');
        }

        // 디바이스 방향 센서(나침반) 활성화: iOS 권한 요청 처리
        const enableOrientation = async () => {
          try {
            if (typeof window.DeviceOrientationEvent !== 'undefined' &&
                typeof window.DeviceOrientationEvent.requestPermission === 'function') {
              const res = await window.DeviceOrientationEvent.requestPermission();
              if (res !== 'granted') return;
            }
            const onOrientation = (ev) => {
              // 일부 브라우저(iOS Safari)는 webkitCompassHeading을 제공 (북쪽=0, 시계방향 증가)
              // 그 외에는 alpha를 사용(북쪽=0, 시계방향 증가 가정). 화면 방향 보정은 필요 시 추가.
              const headingFromWebkit = typeof ev.webkitCompassHeading === 'number' ? ev.webkitCompassHeading : null;
              const alpha = typeof ev.alpha === 'number' ? ev.alpha : null;
              const headingDeg = headingFromWebkit ?? alpha;
              if (typeof headingDeg === 'number') {
                const deg = Math.round(headingDeg);
                window.__headingDeg = deg;
                // 마커 이미지 회전으로 방향 표현
                try { window.__myLocationMarker?.setImage(makeRotatedMarkerImage(deg)); } catch {}
              }
            };
            window.addEventListener('deviceorientation', onOrientation);
            window.__onOrientation = onOrientation;
          } catch (e) {
            console.warn('Device orientation permission error', e);
          }
        };

        // 사용자가 맵을 최초 클릭하면 방향 센서 권한 요청 시도 (iOS Safari 대응)
        const oneTimeClick = () => {
          enableOrientation();
          container.removeEventListener('click', oneTimeClick);
        };
        container.addEventListener('click', oneTimeClick);
      }
      return () => {
        canceled = true;
        setMapReady(false);
        if (cleanupTarget) cleanupTarget.removeEventListener('load', handleScriptLoad);
      };
    }, []);

    useEffect(() => {
      if (Array.isArray(busData) && busData.length) {
        mergeIncomingBuses(busData.filter(Boolean));
      }
    }, [busData, mergeIncomingBuses]);


    const handleMarkerMove = useCallback(({ id, position, item }) => {
      if (!mapReady || !map.current) return;
      if (!id || followBusIdRef.current !== id) return;

      const lat = typeof position?.getLat === 'function' ? position.getLat() : item?.lat;
      const lng = typeof position?.getLng === 'function' ? position.getLng() : item?.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const override = manualOverrideRef.current;
      const manualActive = override.until === Infinity || override.until > now;
      if (manualActive) {
        return;
      }

      const prev = lastFollowedRef.current;
      const hasPrev = prev?.id === id && Number.isFinite(prev.lat) && Number.isFinite(prev.lng);
      const diffLat = hasPrev ? Math.abs(lat - prev.lat) : Infinity;
      const diffLng = hasPrev ? Math.abs(lng - prev.lng) : Infinity;

      if (hasPrev && diffLat < MAP_FOLLOW_EPSILON && diffLng < MAP_FOLLOW_EPSILON) return;

      const kakaoPos = position ?? (window.kakao?.maps ? new window.kakao.maps.LatLng(lat, lng) : null);
      if (!kakaoPos) return;

      const stepNow = typeof performance !== 'undefined' ? performance.now() : Date.now();

      try {
        if (!hasPrev) {
          map.current.setCenter(kakaoPos);
        } else {
          const elapsed = stepNow - (lastPanAtRef.current || 0);
          if (elapsed < MAP_PAN_INTERVAL) return;
          if (typeof map.current.panTo === 'function') {
            map.current.panTo(kakaoPos);
          } else {
            map.current.setCenter(kakaoPos);
          }
        }
        lastFollowedRef.current = { id, lat, lng };
        lastPanAtRef.current = stepNow;
      } catch (error) {
        console.warn('지도 중심 이동 실패', error);
      }
    }, [mapReady]);

    useEffect(() => {
      if (!mapReady || !map.current) return;
      updateBusMarkers({
        map: map.current,
        data,
        markerImage: busMarkerImageRef.current ?? undefined,
        markersRef: busMarkersRef,
        overlaysRef: busOverlaysRef,
        metaRef: busMetaRef,
        selectedOrg,
        selectedBusFilter,
        onMarkerMove: handleMarkerMove,
      });
    }, [data, mapReady, selectedOrg, selectedBusFilter, handleMarkerMove]);

    useEffect(() => {
      if (!mapReady || !map.current) return;

      const meta = busMetaRef.current;
      if (!meta.size) {
        followBusIdRef.current = null;
        prevBusFilterRef.current = selectedBusFilter;
        return;
      }

      const operatorFilter = typeof selectedBusFilter === 'number' && Number.isFinite(selectedBusFilter)
        ? selectedBusFilter
        : null;
      const selectedOrgKey = orgKeyFromSelection(selectedOrg);
      const now = typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
      const manualActive = manualOverrideRef.current.until > now || manualOverrideRef.current.until === Infinity;
      const orgChanged = selectedOrg !== prevOrgRef.current;
      const busChanged = selectedBusFilter !== prevBusFilterRef.current;
      if (manualActive) {
        if (operatorFilter !== null || selectedOrgKey) {
          const triggeredByUserSelection = orgChanged || busChanged;
          if (triggeredByUserSelection) {
            manualOverrideRef.current = { until: 0, reason: null };
          } else {
            prevBusFilterRef.current = selectedBusFilter;
            prevOrgRef.current = selectedOrg;
            return;
          }
        } else {
          prevBusFilterRef.current = selectedBusFilter;
          prevOrgRef.current = selectedOrg;
          return;
        }
      }
      if ((operatorFilter !== null || selectedOrgKey) && manualOverrideRef.current.until) {
        manualOverrideRef.current = { until: 0, reason: null };
      }

      if (operatorFilter === null) {
        followBusIdRef.current = null;
        lastFollowedRef.current = { id: null, lat: null, lng: null };

        if (selectedOrgKey) {
          const positions = [];
          for (const value of meta.values()) {
            if (value?.orgKey !== selectedOrgKey) continue;
            const marker = busMarkersRef.current.get(value.id);
            const markerPos = marker?.getPosition?.();
            if (markerPos) {
              positions.push(markerPos);
              continue;
            }
            if (Number.isFinite(value?.lat) && Number.isFinite(value?.lng) && window.kakao?.maps) {
              positions.push(new window.kakao.maps.LatLng(value.lat, value.lng));
            }
          }

          if (positions.length === 1) {
            try {
              map.current.setCenter(positions[0]);
            } catch (error) {
              console.warn('기관 중심 이동 실패', error);
            }
            return;
          }

          if (positions.length > 1 && window.kakao?.maps) {
            try {
              const bounds = new window.kakao.maps.LatLngBounds();
              positions.forEach((pos) => bounds.extend(pos));
              map.current.setBounds(bounds, 80, 80, 80, 80);
            } catch (error) {
              console.warn('기관 영역 맞추기 실패', error);
            }
            return;
          }
        }

        const fallbackPos = window.__myLocationMarker?.getPosition?.()
          ?? (window.kakao?.maps ? new window.kakao.maps.LatLng(INITIAL_POSITION.lat, INITIAL_POSITION.lng) : null);
        if (fallbackPos) {
          try {
            map.current.setCenter(fallbackPos);
          } catch (error) {
            console.warn('전체보기 중심 이동 실패', error);
          }
        }
        prevBusFilterRef.current = selectedBusFilter;
        prevBusFilterRef.current = selectedBusFilter;
        prevOrgRef.current = selectedOrg;
        return;
      }

      let target = null;

      for (const value of meta.values()) {
        if (selectedOrgKey && value?.orgKey && value.orgKey !== selectedOrgKey) {
          continue;
        }
        if (Number(value?.operatorId) === operatorFilter) {
          target = value;
          break;
        }
      }
      if (!target) {
        followBusIdRef.current = null;
        prevBusFilterRef.current = selectedBusFilter;
        prevBusFilterRef.current = selectedBusFilter;
        prevOrgRef.current = selectedOrg;
        return;
      }

      if (followBusIdRef.current === target.id) {
        prevBusFilterRef.current = selectedBusFilter;
        return;
      }

      followBusIdRef.current = target.id;
      lastFollowedRef.current = { id: null, lat: null, lng: null };

      const marker = busMarkersRef.current.get(target.id);
      const pos = marker?.getPosition?.();
      const lat = typeof pos?.getLat === 'function' ? pos.getLat() : target.lat;
      const lng = typeof pos?.getLng === 'function' ? pos.getLng() : target.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const centerPos = pos ?? (window.kakao?.maps ? new window.kakao.maps.LatLng(lat, lng) : null);
      if (!centerPos) return;

      try {
        map.current.setCenter(centerPos);
        lastFollowedRef.current = { id: target.id, lat, lng };
        lastPanAtRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now();
      } catch (error) {
        console.warn('지도 중심 이동 실패', error);
      }
      prevBusFilterRef.current = selectedBusFilter;
      prevOrgRef.current = selectedOrg;
    }, [selectedOrg, selectedBusFilter, data, mapReady]);

    useEffect(() => () => {
      busMarkersRef.current.forEach((marker) => marker.setMap(null));
      busMarkersRef.current.clear();
      busOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
      busOverlaysRef.current.clear();
      lastFollowedRef.current = { id: null, lat: null, lng: null };
      followBusIdRef.current = null;
      lastPanAtRef.current = 0;
      manualOverrideRef.current = { until: 0, reason: null };
      stopAllAnimations();
    }, []);

    return (
        <div ref={mapContainer} className={styles.mapContainer}></div>
  );
};

export default MapContainer;
