import busRoutes from "../routes/busRoutes";

export default function drawBusRoute(map) {
  if (!map?.current) return;

  busRoutes.forEach((route) => {
    const linePath = route.path.map(
      (point) => new window.kakao.maps.LatLng(point.lat, point.lng)
    );

    new window.kakao.maps.Polyline({
      path: linePath,
      strokeWeight: 4,
      strokeColor: "#3b82f6", // 파란색
      strokeOpacity: 0.8,
      strokeStyle: "solid",
      strokeLineJoin: "round",
      endArrow: true,
      map: map.current,
    });
  });
}