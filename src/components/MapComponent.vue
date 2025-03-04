<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import { useOrdersStore } from '../stores/orders';

// Fix for Leaflet icon issue - import but don't use directly
// These imports are needed for Leaflet to work properly
import 'leaflet/dist/images/marker-icon.png';
import 'leaflet/dist/images/marker-shadow.png';

const router = useRouter();
const mapContainer = ref<HTMLElement | null>(null);
let map: L.Map | null = null;
let routingControl: L.Routing.Control | null = null;
let startMarker: L.Marker | null = null;
let endMarker: L.Marker | null = null;
let currentLocationMarker: L.Marker | null = null;
let pickingMode: 'start' | 'end' | null = null;

// Default coordinates (center of Czech Republic)
const defaultCoords = [49.8175, 15.4730] as [number, number];

// Waypoints for the route
const startPoint = ref<[number, number]>(defaultCoords);
const endPoint = ref<[number, number] | null>(null);

// Form inputs
const startAddress = ref('');
const endAddress = ref('');
const isLoading = ref(false);
const errorMessage = ref<string | null>(null);

// Route information
const routeDistance = ref<number | null>(null);
const routePrice = ref<number | null>(null);
const PRICE_PER_KM = 20; // 20 CZK per kilometer

// Map theme
const mapTheme = ref<'light' | 'dark' | 'satellite'>('dark'); // Default to dark theme

const mapTiles = {
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  }
};
let tileLayer: L.TileLayer | null = null;

// Autocomplete suggestions
const startSuggestions = ref<Array<{display_name: string, lat?: string, lon?: string}>>([]);
const endSuggestions = ref<Array<{display_name: string, lat?: string, lon?: string}>>([]);
const showStartSuggestions = ref(false);
const showEndSuggestions = ref(false);
const isSearchingStart = ref(false);
const isSearchingEnd = ref(false);

// Order form
const showOrderForm = ref(false);
const customerName = ref('');
const customerEmail = ref('');
const customerPhone = ref('');
const pickupDate = ref('');
const pickupTime = ref('');
const additionalNotes = ref('');
const isSubmitting = ref(false);
const orderSuccess = ref(false);
const orderError = ref('');
const paymentUrl = ref<string | null>(null);

// Track if addresses were selected from suggestions
const startAddressSelected = ref(false);
const endAddressSelected = ref(false);

// Flag to prevent multiple route updates
const isUpdatingRoute = ref(false);

// Flag to prevent showing suggestions after selection
const suppressStartSuggestions = ref(false);
const suppressEndSuggestions = ref(false);

// Order steps
const currentStep = ref<'details' | 'payment'>('details');

// Initialize the map
onMounted(() => {
  if (!mapContainer.value) return;

  // Create map with default coordinates (center of Czech Republic)
  map = L.map(mapContainer.value).setView(defaultCoords, 7); // Zoom level 7 to show all of Czech Republic
  
  // Add tile layer (dark theme by default)
  tileLayer = L.tileLayer(mapTiles.dark.url, {
    attribution: mapTiles.dark.attribution,
    maxZoom: 19
  }).addTo(map);

  // Try to get user's location
  getUserLocation();

  // Add click event listener to map for point selection
  map.on('click', handleMapClick);

  // Add click event listener to document to close suggestions when clicking outside
  document.addEventListener('click', handleClickOutside);
});

// Get user's location
const getUserLocation = () => {
  if (!map) return;
  
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        
        // Update map view to user's location
        map?.setView([latitude, longitude], 13);
        
        // Add a marker for current location
        if (currentLocationMarker) {
          currentLocationMarker.setLatLng([latitude, longitude]);
        } else {
          // Create a custom icon for current location
          const currentLocationIcon = L.divIcon({
            className: 'current-location-marker',
            html: '<div class="current-location-dot"><div class="current-location-pulse"></div></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          
          if (map) {
            currentLocationMarker = L.marker([latitude, longitude], {
              icon: currentLocationIcon,
              zIndexOffset: 1000 // Make sure it's above other markers
            }).addTo(map);
          }
          
          // No popup for current location marker
        }
        
        // Reverse geocode to get address
        reverseGeocode([latitude, longitude], true);
        
        // Mark start address as selected since it's from geolocation
        startAddressSelected.value = true;
      },
      (error) => {
        console.error('Geolocation error:', error.message);
        // Fallback to default location (center of Czech Republic)
        // No need to do anything as the map is already centered on Czech Republic
      },
      { 
        enableHighAccuracy: true,
        timeout: 10000, // Increased timeout to 10 seconds
        maximumAge: 0
      }
    );
  }
};

// Reverse geocode coordinates to address
const reverseGeocode = async (coords: [number, number], isStart: boolean) => {
  try {
    const [lat, lon] = coords;
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'cs,en;q=0.9',
          'User-Agent': 'Vue Route Planner App'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Reverse geocoding failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (isStart) {
      startAddress.value = data.display_name;
      startPoint.value = coords;
      suppressStartSuggestions.value = true;
    } else {
      endAddress.value = data.display_name;
      endPoint.value = coords;
      suppressEndSuggestions.value = true;
    }
  } catch (error) {
    // Improved error handling
    if (error instanceof Error) {
      console.error('Reverse geocoding error:', error.message);
    } else {
      console.error('Reverse geocoding error:', error);
    }
    // Don't show error to user for reverse geocoding
  }
};

// Handle map click for point selection
const handleMapClick = (e: L.LeafletMouseEvent) => {
  if (!map || !pickingMode) return;
  
  const { lat, lng } = e.latlng;
  const coords: [number, number] = [lat, lng];
  
  if (pickingMode === 'start') {
    // Create custom start icon
    const startIconDiv = L.divIcon({
      className: 'custom-marker start-marker',
      html: `<div class="marker-pin">Start</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36]
    });
    
    // Update start marker
    if (startMarker) {
      startMarker.setLatLng(e.latlng);
    } else if (map) {
      startMarker = L.marker(e.latlng, { icon: startIconDiv }).addTo(map);
    }
    
    // Update start point and address
    startPoint.value = coords;
    reverseGeocode(coords, true);
    
    // Mark as selected since it's from map click
    startAddressSelected.value = true;
    suppressStartSuggestions.value = true;
  } else if (pickingMode === 'end') {
    // Create custom end icon
    const endIconDiv = L.divIcon({
      className: 'custom-marker end-marker',
      html: `<div class="marker-pin">End</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36]
    });
    
    // Update end marker
    if (endMarker) {
      endMarker.setLatLng(e.latlng);
    } else if (map) {
      endMarker = L.marker(e.latlng, { icon: endIconDiv }).addTo(map);
    }
    
    // Update end point and address
    endPoint.value = coords;
    reverseGeocode(coords, false);
    
    // Mark as selected since it's from map click
    endAddressSelected.value = true;
    suppressEndSuggestions.value = true;
  }
  
  // Exit picking mode
  pickingMode = null;
  
  // Remove the picking-mode class
  mapContainer.value?.classList.remove('picking-mode');
};

// Start point selection mode
const startPickingPoint = (type: 'start' | 'end') => {
  if (!map) return;
  
  pickingMode = type;
  
  // Show instruction tooltip
  const message = type === 'start' 
    ? 'Click on the map to select a starting point' 
    : 'Click on the map to select a destination point';
  
  // Create a temporary popup in the center of the map
  const center = map.getCenter();
  L.popup()
    .setLatLng(center)
    .setContent(`<div class="map-instruction">${message}</div>`)
    .openOn(map);
  
  // Change cursor to indicate selection mode
  mapContainer.value?.classList.add('picking-mode');
};

// Change map theme
const changeMapTheme = (theme: 'light' | 'dark' | 'satellite') => {
  if (!map || !tileLayer) return;
  
  mapTheme.value = theme;
  map.removeLayer(tileLayer);
  
  tileLayer = L.tileLayer(mapTiles[theme].url, {
    attribution: mapTiles[theme].attribution,
    maxZoom: 19
  }).addTo(map);
};

// Clean up on component unmount
onUnmounted(() => {
  if (map) {
    map.remove();
    map = null;
  }
  document.removeEventListener('click', handleClickOutside);
});

// Close suggestions when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.autocomplete-container')) {
    showStartSuggestions.value = false;
    showEndSuggestions.value = false;
  }
};

// Debounce function to limit API calls
const debounce = (fn: Function, delay: number) => {
  let timeout: number | null = null;
  return (...args: any[]) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      fn(...args);
    }, delay) as unknown as number;
  };
};

// Search for address suggestions
const searchAddressSuggestions = async (query: string, isStart: boolean) => {
  // Don't search if we're suppressing suggestions
  if ((isStart && suppressStartSuggestions.value) || (!isStart && suppressEndSuggestions.value)) {
    return;
  }

  if (query.length < 3) {
    if (isStart) {
      startSuggestions.value = [];
      showStartSuggestions.value = false;
    } else {
      endSuggestions.value = [];
      showEndSuggestions.value = false;
    }
    return;
  }

  try {
    if (isStart) {
      isSearchingStart.value = true;
    } else {
      isSearchingEnd.value = true;
    }

    const encodedQuery = encodeURIComponent(query);
    // Add countrycodes=cz parameter to limit results to Czech Republic
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&countrycodes=cz&limit=5`,
      {
        headers: {
          'Accept-Language': 'cs,en;q=0.9',
          'User-Agent': 'Vue Route Planner App'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Search failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (isStart) {
      startSuggestions.value = data;
      showStartSuggestions.value = data.length > 0 && !suppressStartSuggestions.value;
    } else {
      endSuggestions.value = data;
      showEndSuggestions.value = data.length > 0 && !suppressEndSuggestions.value;
    }
  } catch (error) {
    // Improved error handling
    if (error instanceof Error) {
      console.error('Address search error:', error.message);
    } else {
      console.error('Address search error:', error);
    }
  } finally {
    if (isStart) {
      isSearchingStart.value = false;
    } else {
      isSearchingEnd.value = false;
    }
  }
};

// Create debounced search functions
const debouncedSearchStart = debounce((query: string) => searchAddressSuggestions(query, true), 300);
const debouncedSearchEnd = debounce((query: string) => searchAddressSuggestions(query, false), 300);

// Watch for changes in address inputs
watch(startAddress, (newValue) => {
  // Only search if user is typing (not when programmatically set)
  if (!suppressStartSuggestions.value) {
    debouncedSearchStart(newValue);
    
    // Reset the selected flag when user types in the input
    if (startAddressSelected.value) {
      startAddressSelected.value = false;
    }
  } else {
    // Reset the suppression after one update cycle
    setTimeout(() => {
      suppressStartSuggestions.value = false;
    }, 100);
  }
});

watch(endAddress, (newValue) => {
  // Only search if user is typing (not when programmatically set)
  if (!suppressEndSuggestions.value) {
    debouncedSearchEnd(newValue);
    
    // Reset the selected flag when user types in the input
    if (endAddressSelected.value) {
      endAddressSelected.value = false;
    }
  } else {
    // Reset the suppression after one update cycle
    setTimeout(() => {
      suppressEndSuggestions.value = false;
    }, 100);
  }
});

// Watch for changes in address selection status and update route when both are selected
// Use a debounced approach to prevent multiple rapid updates
const debouncedRouteUpdate = debounce(() => {
  if (startAddressSelected.value && endAddressSelected.value && 
      startPoint.value && endPoint.value && !isUpdatingRoute.value) {
    updateRoute();
  }
}, 300);

watch([startAddressSelected, endAddressSelected], 
  () => {
    if (startAddressSelected.value && endAddressSelected.value) {
      debouncedRouteUpdate();
    }
  },
  { immediate: true }
);

// Select a suggestion
const selectSuggestion = (suggestion: {display_name: string, lat?: string, lon?: string}, isStart: boolean) => {
  if (isStart) {
    // Suppress suggestions to prevent them from showing again
    suppressStartSuggestions.value = true;
    
    // Set coordinates first
    if (suggestion.lat && suggestion.lon) {
      const lat = parseFloat(suggestion.lat);
      const lon = parseFloat(suggestion.lon);
      startPoint.value = [lat, lon];
      
      // Create custom start icon
      const startIconDiv = L.divIcon({
        className: 'custom-marker start-marker',
        html: `<div class="marker-pin">Start</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36]
      });
      
      // Update marker if it exists
      if (map && startMarker) {
        startMarker.setLatLng(L.latLng(lat, lon));
      } else if (map) {
        startMarker = L.marker(L.latLng(lat, lon), { icon: startIconDiv }).addTo(map);
      }
    }
    
    // Update address and hide suggestions
    startAddress.value = suggestion.display_name;
    showStartSuggestions.value = false;
    
    // Mark as selected from suggestions - do this AFTER updating coordinates
    startAddressSelected.value = true;
  } else {
    // Suppress suggestions to prevent them from showing again
    suppressEndSuggestions.value = true;
    
    // Set coordinates first
    if (suggestion.lat && suggestion.lon) {
      const lat = parseFloat(suggestion.lat);
      const lon = parseFloat(suggestion.lon);
      endPoint.value = [lat, lon];
      
      // Create custom end icon
      const endIconDiv = L.divIcon({
        className: 'custom-marker end-marker',
        html: `<div class="marker-pin">End</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36]
      });
      
      // Update marker if it exists
      if (map && endMarker) {
        endMarker.setLatLng(L.latLng(lat, lon));
      } else if (map) {
        endMarker = L.marker(L.latLng(lat, lon), { icon: endIconDiv }).addTo(map);
      }
    }
    
    // Update address and hide suggestions
    endAddress.value = suggestion.display_name;
    showEndSuggestions.value = false;
    
    // Mark as selected from suggestions - do this AFTER updating coordinates
    endAddressSelected.value = true;
  }
};

// Geocode an address to coordinates using Nominatim API
const geocodeAddress = async (address: string): Promise<[number, number]> => {
  try {
    const encodedAddress = encodeURIComponent(address);
    // Add countrycodes=cz parameter to limit results to Czech Republic
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&countrycodes=cz&limit=1`,
      {
        headers: {
          'Accept-Language': 'cs,en;q=0.9',
          'User-Agent': 'Vue Route Planner App'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Geocoding failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.length === 0) {
      throw new Error(`Address not found: ${address}`);
    }
    
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch (error) {
    // Improved error handling
    if (error instanceof Error) {
      console.error('Geocoding error:', error.message);
      throw error; // Re-throw to handle in the calling function
    } else {
      console.error('Geocoding error:', error);
      throw new Error('Unknown geocoding error occurred');
    }
  }
};

// Format distance in kilometers
const formatDistance = (meters: number): string => {
  const kilometers = meters / 1000;
  return kilometers.toFixed(1);
};

// Format price in CZK
const formatPrice = (price: number): string => {
  return price.toLocaleString('cs-CZ');
};

// Update the route based on form inputs
const updateRoute = async () => {
  if (!map || !startAddress.value || !endAddress.value) return;
  
  // Check if both addresses were selected from suggestions or map
  if (!startAddressSelected.value || !endAddressSelected.value) {
    errorMessage.value = 'Please select addresses from the suggestions or map';
    return;
  }
  
  // Prevent multiple simultaneous route updates
  if (isUpdatingRoute.value) return;
  isUpdatingRoute.value = true;
  
  errorMessage.value = null;
  isLoading.value = true;
  routeDistance.value = null;
  routePrice.value = null;
  showOrderForm.value = false;
  
  try {
    // Use existing coordinates if available
    let startCoords = startPoint.value;
    let endCoords = endPoint.value;
    
    // Only geocode if we don't have coordinates
    if (!startCoords || !endCoords) {
      [startCoords, endCoords] = await Promise.all([
        geocodeAddress(startAddress.value),
        geocodeAddress(endAddress.value)
      ]);
      
      // Update waypoint refs
      startPoint.value = startCoords;
      endPoint.value = endCoords;
    }
    
    // Create custom start icon
    const startIconDiv = L.divIcon({
      className: 'custom-marker start-marker',
      html: `<div class="marker-pin">Start</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36]
    });
    
    // Create custom end icon
    const endIconDiv = L.divIcon({
      className: 'custom-marker end-marker',
      html: `<div class="marker-pin">End</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36]
    });
    
    // Update or create markers
    if (map) {
      if (startMarker) {
        startMarker.setLatLng(L.latLng(startCoords[0], startCoords[1]));
      } else {
        startMarker = L.marker(L.latLng(startCoords[0], startCoords[1]), { icon: startIconDiv }).addTo(map);
      }
      
      if (endMarker) {
        endMarker.setLatLng(L.latLng(endCoords[0], endCoords[1]));
      } else {
        endMarker = L.marker(L.latLng(endCoords[0], endCoords[1]), { icon: endIconDiv }).addTo(map);
      }
      
      // Remove previous routing control if it exists
      if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
      }
      
      // Create new routing control with the itinerary panel hidden
      routingControl = L.Routing.control({
        waypoints: [
          L.latLng(startCoords[0], startCoords[1]),
          L.latLng(endCoords[0], endCoords[1])
        ],
        routeWhileDragging: false, // Disable to prevent constant recalculation
        showAlternatives: true,
        fitSelectedRoutes: true,
        lineOptions: {
          styles: [{ color: '#6366F1', weight: 6 }],
          extendToWaypoints: true,
          missingRouteTolerance: 0
        },
        show: false, // Hide the control panel
        collapsible: false, // Prevent showing even when collapsed
        itineraryClassName: 'hidden-itinerary' // Apply custom class to hide it with CSS
      }).addTo(map);

      // Get route information when route is calculated
      routingControl.on('routesfound', (e) => {
        const routes = e.routes;
        if (routes && routes.length > 0) {
          // Get distance in meters from the first route
          const distanceInMeters = routes[0].summary.totalDistance;
          routeDistance.value = distanceInMeters;
          
          // Calculate price based on distance (20 CZK per km)
          const distanceInKm = distanceInMeters / 1000;
          routePrice.value = Math.round(distanceInKm * PRICE_PER_KM);
          
          // Show order form after route is calculated
          showOrderForm.value = true;
          
          // Reset to details step
          currentStep.value = 'details';
        }
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      errorMessage.value = error.message;
    } else {
      errorMessage.value = 'An unknown error occurred';
    }
  } finally {
    isLoading.value = false;
    isUpdatingRoute.value = false;
  }
};

// Get orders store
const ordersStore = useOrdersStore();

// Continue to payment step
const continueToPayment = () => {
  // Validate form
  if (!customerName.value || !customerEmail.value || !customerPhone.value || !pickupDate.value || !pickupTime.value) {
    orderError.value = 'Please fill in all required fields';
    return;
  }
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(customerEmail.value)) {
    orderError.value = 'Please enter a valid email address';
    return;
  }
  
  // Phone validation (simple check)
  const phoneRegex = /^\+?[0-9\s\-\(\)]{8,}$/;
  if (!phoneRegex.test(customerPhone.value)) {
    orderError.value = 'Please enter a valid phone number';
    return;
  }
  
  // Move to payment step
  currentStep.value = 'payment';
};

// Submit order form
const submitOrder = async () => {
  if (!routeDistance.value || !routePrice.value || !endPoint.value) return;
  
  isSubmitting.value = true;
  orderError.value = '';
  
  try {
    // Save order to database via store
    const result = await ordersStore.addOrder({
      customerName: customerName.value,
      customerEmail: customerEmail.value,
      customerPhone: customerPhone.value,
      pickupDate: pickupDate.value,
      pickupTime: pickupTime.value,
      startAddress: startAddress.value,
      endAddress: endAddress.value,
      startPoint: startPoint.value,
      endPoint: endPoint.value,
      distance: routeDistance.value,
      price: routePrice.value,
      additionalNotes: additionalNotes.value || undefined
    });
    
    if (!result || !result.orderId) {
      throw new Error('Failed to save order');
    }
    
    // Store payment URL for redirect
    paymentUrl.value = result.paymentUrl || null;
    
    // Show success message
    orderSuccess.value = true;
    
    // Reset form fields but keep the order data
    customerName.value = '';
    customerEmail.value = '';
    customerPhone.value = '';
    pickupDate.value = '';
    pickupTime.value = '';
    additionalNotes.value = '';
  } catch (error) {
    console.error('Order submission error:', error instanceof Error ? error.message : 'Unknown error');
    orderError.value = 'Failed to submit order. Please try again.';
  } finally {
    isSubmitting.value = false;
  }
};

// Proceed to payment
const proceedToPayment = () => {
  if (paymentUrl.value) {
    window.location.href = paymentUrl.value;
  }
};

// Go back to details step
const backToDetails = () => {
  currentStep.value = 'details';
};

// Reset to default values
const resetForm = () => {
  startAddress.value = '';
  endAddress.value = '';
  errorMessage.value = null;
  routeDistance.value = null;
  routePrice.value = null;
  showOrderForm.value = false;
  orderSuccess.value = false;
  orderError.value = '';
  paymentUrl.value = null;
  currentStep.value = 'details';
  
  // Reset selection flags
  startAddressSelected.value = false;
  endAddressSelected.value = false;
  suppressStartSuggestions.value = false;
  suppressEndSuggestions.value = false;
  
  // Reset order form
  customerName.value = '';
  customerEmail.value = '';
  customerPhone.value = '';
  pickupDate.value = '';
  pickupTime.value = '';
  additionalNotes.value = '';
  
  // Remove markers
  if (map) {
    if (startMarker) {
      map.removeLayer(startMarker);
      startMarker = null;
    }
    if (endMarker) {
      map.removeLayer(endMarker);
      endMarker = null;
    }
  }
  
  // Remove routing
  if (map && routingControl) {
    map.removeControl(routingControl);
    routingControl = null;
  }
  
  // Reset points
  startPoint.value = defaultCoords;
  endPoint.value = null;
  
  // Try to get user location again
  getUserLocation();
};

// Get today's date in YYYY-MM-DD format for min date in date picker
const today = new Date().toISOString().split('T')[0];
</script>

<template>
  <div class="map-container">
    <div class="form-container">
      <h2>Plan Your Route</h2>
      <form>
        <div class="form-group">
          <h3>Starting Point</h3>
          <div class="input-group autocomplete-container">
            <label for="start-address">Address:</label>
            <div class="relative">
              <input 
                id="start-address" 
                v-model="startAddress" 
                type="text" 
                placeholder="Enter starting address in Czech Republic" 
                required 
                @focus="showStartSuggestions = startSuggestions.length > 0 && !suppressStartSuggestions"
              />
              <button 
                type="button" 
                class="map-pick-button" 
                title="Pick location on map"
                @click.prevent="startPickingPoint('start')"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
              </button>
              <div v-if="isSearchingStart" class="loader"></div>
              <div v-if="showStartSuggestions && !suppressStartSuggestions" class="suggestions-list">
                <div 
                  v-for="(suggestion, index) in startSuggestions" 
                  :key="index"
                  class="suggestion-item"
                  @click="selectSuggestion(suggestion, true)"
                >
                  {{ suggestion.display_name }}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="form-group">
          <h3>Destination</h3>
          <div class="input-group autocomplete-container">
            <label for="end-address">Address:</label>
            <div class="relative">
              <input 
                id="end-address" 
                v-model="endAddress" 
                type="text" 
                placeholder="Enter destination address in Czech Republic" 
                required 
                @focus="showEndSuggestions = endSuggestions.length > 0 && !suppressEndSuggestions"
              />
              <button 
                type="button" 
                class="map-pick-button" 
                title="Pick location on map"
                @click.prevent="startPickingPoint('end')"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
              </button>
              <div v-if="isSearchingEnd" class="loader"></div>
              <div v-if="showEndSuggestions && !suppressEndSuggestions" class="suggestions-list">
                <div 
                  v-for="(suggestion, index) in endSuggestions" 
                  :key="index"
                  class="suggestion-item"
                  @click="selectSuggestion(suggestion, false)"
                >
                  {{ suggestion.display_name }}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
        
        <!-- Route Information Section -->
        <div v-if="routeDistance !== null && routePrice !== null" class="route-info">
          <h3>Route Information</h3>
          <div class="info-item">
            <span class="info-label">Distance:</span>
            <span class="info-value">{{ formatDistance(routeDistance) }} km</span>
          </div>
          <div class="info-item">
            <span class="info-label">Price (20 CZK/km):</span>
            <span class="info-value">{{ formatPrice(routePrice) }} CZK</span>
          </div>
        </div>
        
        <!-- Order Form - Details Step -->
        <div v-if="showOrderForm && !orderSuccess && currentStep === 'details'" class="order-form">
          <h3>Book Your Ride</h3>
          
          <div class="form-group">
            <label for="customer-name">Full Name*</label>
            <input 
              id="customer-name" 
              v-model="customerName" 
              type="text" 
              placeholder="Enter your full name" 
              required
            />
          </div>
          
          <div class="form-group">
            <label for="customer-email">Email*</label>
            <input 
              id="customer-email" 
              v-model="customerEmail" 
              type="email" 
              placeholder="Enter your email address" 
              required
            />
          </div>
          
          <div class="form-group">
            <label for="customer-phone">Phone Number*</label>
            <input 
              id="customer-phone" 
              v-model="customerPhone" 
              type="tel" 
              placeholder="Enter your phone number" 
              required
            />
          </div>
          
          <div class="form-row">
            <div class="form-group half">
              <label for="pickup-date">Pickup Date*</label>
              <input 
                id="pickup-date" 
                v-model="pickupDate" 
                type="date" 
                :min="today"
                required
              />
            </div>
            
            <div class="form-group half">
              <label for="pickup-time">Pickup Time*</label>
              <input 
                id="pickup-time" 
                v-model="pickupTime" 
                type="time" 
                required
              />
            </div>
          </div>
          
          <div class="form-group">
            <label for="additional-notes">Additional Notes</label>
            <textarea 
              id="additional-notes" 
              v-model="additionalNotes" 
              placeholder="Any special requirements or information"
              rows="3"
            ></textarea>
          </div>
          
          <div v-if="orderError" class="error-message">
            {{ orderError }}
          </div>
          
          <div class="button-group">
            <button 
              type="button" 
              @click="continueToPayment" 
              class="submit-button" 
              :disabled="isSubmitting"
            >
              Continue to Payment
            </button>
          </div>
        </div>
        
        <!-- Order Form - Payment Step -->
        <div v-if="showOrderForm && !orderSuccess && currentStep === 'payment'" class="order-form payment-step">
          <h3>Payment Information</h3>
          
          <div class="payment-summary">
            <h4>Order Summary</h4>
            <div class="summary-row">
              <span>From:</span>
              <span>{{ startAddress }}</span>
            </div>
            <div class="summary-row">
              <span>To:</span>
              <span>{{ endAddress }}</span>
            </div>
            <div class="summary-row">
              <span>Distance:</span>
              <span>{{ formatDistance(routeDistance!) }} km</span>
            </div>
            <div class="summary-row">
              <span>Pickup:</span>
              <span>{{ pickupDate }} at {{ pickupTime }}</span>
            </div>
            <div class="summary-row total">
              <span>Total Price:</span>
              <span>{{ formatPrice(routePrice!) }} CZK</span>
            </div>
          </div>
          
          <div class="payment-methods">
            <h4>Select Payment Method</h4>
            <div class="payment-method-options">
              <div class="payment-method selected">
                <input type="radio" id="card-payment" name="payment-method" checked />
                <label for="card-payment">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                    <line x1="1" y1="10" x2="23" y2="10"></line>
                  </svg>
                  Credit/Debit Card
                </label>
              </div>
              <div class="payment-method">
                <input type="radio" id="bank-transfer" name="payment-method" disabled />
                <label for="bank-transfer" class="disabled">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 11 12 14 22 4"></polyline>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                  </svg>
                  Bank Transfer (Coming Soon)
                </label>
              </div>
            </div>
          </div>
          
          <div class="payment-notice">
            <p>Your order will only be confirmed after successful payment. You will be redirected to our secure payment gateway.</p>
          </div>
          
          <div v-if="orderError" class="error-message">
            {{ orderError }}
          </div>
          
          <div class="button-group">
            <button 
              type="button" 
              @click="backToDetails" 
              class="back-button" 
              :disabled="isSubmitting"
            >
              Back
            </button>
            <button 
              type="button" 
              @click="submitOrder" 
              class="submit-button" 
              :disabled="isSubmitting"
            >
              {{ isSubmitting ? 'Processing...' : 'Complete Payment' }}
            </button>
          </div>
        </div>
        
        <!-- Order Success Message -->
        <div v-if="orderSuccess" class="success-message">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <h3>Booking Confirmed!</h3>
          <p>Thank you for your booking. A confirmation email has been sent to your email address.</p>
          
          <div v-if="paymentUrl" class="payment-buttons">
            <button type="button" @click="proceedToPayment" class="payment-button">
              Proceed to Payment
            </button>
          </div>
          
          <button type="button" @click="resetForm" class="reset-button">Plan Another Route</button>
        </div>
        
        <div v-if="!showOrderForm && !orderSuccess" class="button-group">
          <button type="button" @click="resetForm" class="reset-button" :disabled="isLoading">
            Reset
          </button>
        </div>
      </form>
      <!-- Theme Toggle -->
      <div class="theme-toggle">
        <div class="theme-options">
          <button 
            @click="changeMapTheme('light')" 
            class="theme-option" 
            :class="{ active: mapTheme === 'light' }"
            title="Light Mode"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <span>Light</span>
          </button>
          <button 
            @click="changeMapTheme('dark')" 
            class="theme-option" 
            :class="{ active: mapTheme === 'dark' }"
            title="Dark Mode"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
            <span>Dark</span>
          </button>
          <button 
            @click="changeMapTheme('satellite')" 
            class="theme-option" 
            :class="{ active: mapTheme === 'satellite' }"
            title="Satellite View"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <line x1="12" y1="2" x2="12" y2="22"></line>
            </svg>
            <span>Satellite</span>
          </button>
        </div>
      </div>
    </div>
    
    <div ref="mapContainer" class="map" :class="{ 'picking-mode': pickingMode !== null, 'dark-theme': mapTheme === 'dark' }"></div>
  </div>
</template>

<style scoped>
.map-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.form-container {
  padding: 1rem;
  background-color: #f9f9f9;
  border-bottom: 1px solid #ddd;
  position: relative;
  z-index: 500;
  overflow-y: auto;
  max-height: 50vh;
}

h2 {
  margin-top: 0;
  color: #333;
  font-size: 1.5rem;
}

h3 {
  margin: 0.5rem 0;
  font-size: 1rem;
  color: #555;
}

h4 {
  margin: 0.5rem 0;
  font-size: 0.9rem;
  color: #555;
}

.form-group {
  margin-bottom: 1rem;
}

.form-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.half {
  flex: 1;
}

.input-group {
  display: flex;
  flex-direction: column;
}

.relative {
  position: relative;
}

label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
}

input, textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.9rem;
}

input[type="text"], input[type="email"], input[type="tel"] {
  padding-right: 2.5rem; /* Make room for the map pick button */
}

textarea {
  resize: vertical;
}

.map-pick-button {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #6366F1;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

.map-pick-button:hover {
  color: #4F46E5;
}

.loader {
  position: absolute;
  right: 40px; /* Move to the left of the map pick button */
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #6366F1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: translateY(-50%) rotate(0deg); }
  100% { transform: translateY(-50%) rotate(360deg); }
}

.suggestions-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 0 0 4px 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.suggestion-item {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #eee;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #333;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover {
  background-color: #f0f0f0;
}

.error-message {
  color: #e53e3e;
  margin: 0.5rem 0;
  padding: 0.5rem;
  background-color: #fed7d7;
  border-radius: 4px;
  font-size: 0.9rem;
}

.success-message {
  margin: 1rem 0; 
  padding: 1rem;
  background-color: #c6f6d5;
  border-radius: 4px;
  text-align: center;
  color: #2f855a;
}

.success-message svg {
  color: #38a169;
  margin-bottom: 0.5rem;
  width: 48px;
  height: 48px;
}

.success-message h3 {
  color: #2f855a;
  margin-bottom: 0.5rem;
}

.success-message p {
  margin-bottom: 1rem;
}

.payment-buttons {
  margin-bottom: 1rem;
}

.payment-button {
  background-color: #38a169;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.payment-button:hover {
  background-color: #2f855a;
}

/* Route Information Styles */
.route-info {
  margin: 1rem 0;
  padding: 0.75rem;
  background-color: #eef2ff;
  border-radius: 4px;
  border-left: 4px solid #6366F1;
}

.info-item {
  display: flex;
  justify-content: space-between;
  margin: 0.5rem 0;
  font-size: 0.95rem;
}

.info-label {
  font-weight: 500;
  color: #4b5563;
}

.info-value {
  font-weight: 600;
  color: #1f2937;
}

/* Order Form Styles */
.order-form {
  margin: 1rem 0;
  padding: 1rem;
  background-color: #f3f4f6;
  border-radius: 4px;
  border-left: 4px solid #6366F1;
}

/* Payment Step Styles */
.payment-step {
  border-left: 4px solid #3b82f6;
}

.payment-summary {
  background-color: #fff;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.summary-row.total {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #e5e7eb;
  font-weight: 600;
  font-size: 1rem;
}

.payment-methods {
  margin-bottom: 1rem;
}

.payment-method-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.payment-method {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  background-color: #fff;
  border-radius: 4px;
  border: 1px solid #e5e7eb;
  cursor: pointer;
}

.payment-method.selected {
  border-color: #6366F1;
  background-color: #eef2ff;
}

.payment-method input {
  margin-right: 0.5rem;
  width: auto;
}

.payment-method label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  cursor: pointer;
  width: 100%;
}

.payment-method label.disabled {
  color: #9ca3af;
  cursor: not-allowed;
}

.payment-method svg {
  color: #6366F1;
}

.payment-notice {
  margin: 1rem 0;
  padding: 0.75rem;
  background-color: #fffbeb;
  border-radius: 4px;
  border-left: 4px solid #f59e0b;
  font-size: 0.85rem;
  color: #92400e;
}

.button-group {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 1rem;
}

button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.reset-button {
  background-color: #e5e7eb;
  color: #374151;
  width: 100%;
}

.reset-button:hover:not(:disabled) {
  background-color: #d1d5db;
}

.back-button {
  background-color: #e5e7eb;
  color: #374151;
  flex: 1;
}

.back-button:hover:not(:disabled) {
  background-color: #d1d5db;
}

.submit-button {
  background-color: #6366F1;
  color: white;
  flex: 2;
}

.submit-button:hover:not(:disabled) {
  background-color: #4F46E5;
}

.map {
  flex: 1;
  width: 100%;
  min-height: 300px; /* Ensure map has a minimum height */
}

/* Theme toggle styles */
.theme-toggle {
  margin-top: 1rem;
}

.theme-options {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.theme-option {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  background-color: #f3f4f6;
  color: #4b5563;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  flex: 1;
  transition: all 0.2s ease;
}

.theme-option:hover {
  background-color: #e5e7eb;
}

.theme-option.active {
  background-color: #6366F1;
  color: white;
}

/* Map instruction popup styles */
:global(.map-instruction) {
  font-weight: 500;
  color: #4b5563;
  padding: 0.25rem 0;
}

/* Cursor styles for picking mode */
.picking-mode {
  cursor: crosshair !important;
}

/* Hide the Leaflet Routing Machine control panel */
:global(.leaflet-routing-container) {
  display: none !important;
}

:global(.hidden-itinerary) {
  display: none !important;
}

/* Dark theme styles for the form container */
:global(.dark-theme .leaflet-popup-content-wrapper) {
  background-color: #1f2937;
  color: #f9fafb;
}

:global(.dark-theme .leaflet-popup-tip) {
  background-color: #1f2937;
}

/* Current location marker styles */
:global(.current-location-dot) {
  width: 16px;
  height: 16px;
  background-color: #3b82f6;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
  position: relative;
}

:global(.current-location-pulse) {
  position: absolute;
  width: 30px;
  height: 30px;
  left: -7px;
  top: -7px;
  background-color: rgba(59, 130, 246, 0.3);
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}

/* Custom marker styles */
:global(.custom-marker) {
  background: transparent;
  border: none;
}

:global(.marker-pin) {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.5));
}

:global(.start-marker svg) {
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.3));
}

:global(.end-marker svg) {
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.3));
}

@keyframes pulse {
  0% {
    transform: scale(0.5);
    opacity: 1;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}

@media (min-width: 768px) {
  .map-container {
    flex-direction: row;
    height: 100%;
  }
  
  .form-container {
    width: 350px;
    border-right: 1px solid #ddd;
    border-bottom: none;
    max-height: 100%;
    overflow-y: auto;
  }
  
  .map {
    flex: 1;
    height: 100%;
  }
}
</style>