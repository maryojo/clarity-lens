document.addEventListener("DOMContentLoaded", () => {
  const grantLocationButton = document.getElementById("grantLocation");
  const closeButton = document.getElementById("closeButton");
  const status = document.getElementById("location-status");

  if (grantLocationButton) {
    grantLocationButton.addEventListener("click", () => {
      if (!status) return;

      status.textContent = "Requesting permission... Look near the URL bar.";

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude.toFixed(2);
            const lon = position.coords.longitude.toFixed(2);
            status.style.color = "#0b9d58"; // Green
            status.textContent = `✅ Location Granted! Lat: ${lat}, Lon: ${lon}`;
            grantLocationButton.disabled = true;
          },
          (error) => {
            let message = "❌ Location permission denied or unavailable.";
            if (error.code === error.PERMISSION_DENIED) {
              message = "❌ Access Denied. You must manually grant permission.";
            }
            status.style.color = "#d32f2f"; // Red
            status.textContent = message;
            console.error("Geolocation Error:", error);
          }
        );
      } else {
        status.textContent = "Geolocation is not supported by your browser.";
      }
    });
  }

  if (closeButton) {
    closeButton.addEventListener("click", () => window.close());
  }
});
