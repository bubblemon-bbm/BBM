/* ------------------------------------------------------------------
 *  카카오맵 주입 스크립트 (독립 실행형)
 *  - 기존 빌드(app.js)는 구글맵스용이라 지도가 안 뜸.
 *  - 이 스크립트가 지도 컨테이너(.googleMap)에 카카오 지도를 그려넣음.
 *  - app.js 를 수정하지 않고 겉에서 얹는 방식.
 * ------------------------------------------------------------------ */
(function () {
  "use strict";

  var KAKAO_KEY = "3f0739842d7e1afad15ecaa69a01bbb6";
  var DATA_URL = "./data/wevape-stores-260826-geo.json";
  var KOREA_CENTER = { lat: 36.5, lng: 127.8 };

  var storesPromise = null;
  var initialized = false;

  // 1) 매장 데이터 미리 로드
  function loadStores() {
    if (!storesPromise) {
      storesPromise = fetch(DATA_URL)
        .then(function (r) { return r.json(); })
        .then(function (j) { return (j && j.stores) || []; })
        .catch(function (e) { console.error("[kakao-map] 매장 데이터 로드 실패", e); return []; });
    }
    return storesPromise;
  }

  // 2) 카카오 SDK 로드
  function loadSdk() {
    return new Promise(function (resolve, reject) {
      if (window.kakao && window.kakao.maps) { resolve(); return; }
      var s = document.createElement("script");
      s.src = "https://dapi.kakao.com/v2/maps/sdk.js?appkey=" + KAKAO_KEY + "&autoload=false";
      s.onload = function () { window.kakao.maps.load(resolve); };
      s.onerror = function () { reject(new Error("카카오 SDK 로드 실패")); };
      document.head.appendChild(s);
    });
  }

  // 3) 지도 컨테이너 찾기 (React가 렌더한 .googleMap div)
  function findContainer() {
    return document.querySelector('[class*="googleMap"]');
  }

  // 4) 지도 그리기
  function renderMap(container, stores) {
    // 숨겨져 있던 지도 자리 강제로 보이게
    container.setAttribute("data-visible", "true");
    container.style.opacity = "1";
    // 타원 플레이스홀더 숨기기
    document.querySelectorAll('[class*="mapFallback"]').forEach(function (f) {
      f.style.display = "none";
    });

    // 지도 놓을 내부 div (컨테이너 꽉 채움)
    var mapEl = document.createElement("div");
    mapEl.id = "kakao-map-injected";
    mapEl.style.position = "absolute";
    mapEl.style.inset = "0";
    mapEl.style.width = "100%";
    mapEl.style.height = "100%";
    container.appendChild(mapEl);

    var kakao = window.kakao;
    var map = new kakao.maps.Map(mapEl, {
      center: new kakao.maps.LatLng(KOREA_CENTER.lat, KOREA_CENTER.lng),
      level: 13,
    });
    map.setMaxLevel(14);

    var valid = stores.filter(function (s) {
      return typeof s.lat === "number" && typeof s.lng === "number";
    });

    var bounds = new kakao.maps.LatLngBounds();
    var infowindow = new kakao.maps.InfoWindow({ removable: true });

    valid.forEach(function (s) {
      var pos = new kakao.maps.LatLng(s.lat, s.lng);
      var marker = new kakao.maps.Marker({ map: map, position: pos, title: s.name });
      bounds.extend(pos);
      kakao.maps.event.addListener(marker, "click", function () {
        var html =
          '<div style="padding:8px 12px;font-size:13px;line-height:1.5;max-width:220px;">' +
          '<strong>' + escapeHtml(s.name) + "</strong><br>" +
          '<span style="color:#666;">' + escapeHtml(s.address || "") + "</span></div>";
        infowindow.setContent(html);
        infowindow.open(map, marker);
      });
    });

    if (valid.length) { map.setBounds(bounds); }

    // 레이아웃 보정 (컨테이너가 뒤늦게 크기 잡히는 경우)
    setTimeout(function () { map.relayout(); if (valid.length) map.setBounds(bounds); }, 300);
    window.addEventListener("resize", function () { map.relayout(); });

    console.log("[kakao-map] 지도 렌더 완료, 매장 " + valid.length + "개");
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // 5) 컨테이너가 나타날 때까지 기다렸다가 1회 실행
  function tryInit() {
    if (initialized) return;
    var container = findContainer();
    if (!container) return;
    initialized = true;
    Promise.all([loadSdk(), loadStores()]).then(function (res) {
      renderMap(container, res[1]);
    }).catch(function (e) { console.error("[kakao-map] 초기화 실패", e); initialized = false; });
  }

  // SPA라서 컨테이너가 나중에 생김 → 폴링 + 옵저버
  var poll = setInterval(function () {
    tryInit();
    if (initialized) clearInterval(poll);
  }, 400);
  // 안전장치: 20초 뒤 폴링 중단
  setTimeout(function () { clearInterval(poll); }, 20000);

  if (document.readyState !== "loading") tryInit();
  else document.addEventListener("DOMContentLoaded", tryInit);
})();
