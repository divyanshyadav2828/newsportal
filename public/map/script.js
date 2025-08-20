// Get the container element for the globe
const globeContainer = document.getElementById('globeViz');

// Initialize the 3D globe
const myGlobe = Globe()
  (globeContainer)
  // 1. Use a realistic satellite image
  .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
  .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')

  // --- Style Update for Realistic Look ---
  .polygonCapColor(() => 'rgba(0, 0, 0, 0)')
  .polygonSideColor(() => 'rgba(0, 100, 255, 0.05)')
  .polygonStrokeColor(() => '#999')

  .polygonLabel(({ properties: d }) => `
    <b>${d.ADMIN}</b> <br />
    Continent: <i>${d.CONTINENT}</i>
  `)
  .polygonAltitude(0.01)
  
  .onPolygonHover(hoverD => myGlobe
    .polygonStrokeColor(d => d === hoverD ? 'white' : '#999')
    .polygonAltitude(d => d === hoverD ? 0.02 : 0.01)
  )
  // --- End of Style Update ---
  
  .onPolygonClick(({ properties: d }) => {
    // Do not redirect for "Seven seas (open ocean)"
    if (d.CONTINENT === 'Seven seas (open ocean)') {
      return;
    }
    const continentName = d.CONTINENT.toLowerCase().replace(/ /g, '-');
    const newUrl = `http://localhost:3000/${continentName}/`;
    window.location.href = newUrl;
  });

// Load the country polygons data
fetch('./countries.geojson')
  .then(res => res.json())
  .then(countries => {
    myGlobe.polygonsData(countries.features);
  });

// Globe settings
myGlobe.controls().autoRotate = true;
myGlobe.controls().autoRotateSpeed = 0.5;
myGlobe.controls().enableZoom = true; // Allow zooming

// =================================================
// ###       Responsiveness Section 📱         ###
// =================================================

// 1. Auto-resize globe to fit the container
myGlobe.width(globeContainer.clientWidth);
myGlobe.height(globeContainer.clientHeight);

const onResize = () => {
    myGlobe.width(globeContainer.clientWidth);
    myGlobe.height(globeContainer.clientHeight);
};
window.addEventListener('resize', onResize, false);


// 2. Set initial camera altitude based on screen size
const isMobile = window.innerWidth < 768;

// For mobile, zoom out more (higher altitude) to see the whole globe
// For desktop, zoom in closer (lower altitude)
myGlobe.pointOfView({ altitude: isMobile ? 3.0 : 2.0 }, 1000);
// =================================================