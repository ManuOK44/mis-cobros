self.addEventListener("install", () => {
  console.log("App instalada");
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});