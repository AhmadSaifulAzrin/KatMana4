// ==========================================
// 1. SETUP ICON & MAP
// ==========================================
const myCustomIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/4899/4899329.png',
    iconSize: [45, 45],
    iconAnchor: [22, 45],
    popupAnchor: [0, -40]
});

const map = L.map('map', { zoomControl: false }).setView([3.1390, 101.6869], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

let currentLatLng = null;
let userMarker = null;
let photoDataArray = []; 

const offcanvas = document.getElementById('offcanvas');
const imageList = document.getElementById('imageList');
const welcomeModal = document.getElementById('welcomeModal');
const gpsModal = document.getElementById('gpsModal');

// ==========================================
// 2. FLOW: SPLASH -> GPS MODAL -> MAP
// ==========================================

document.getElementById('startApp').onclick = () => {
    welcomeModal.style.transition = "all 0.8s ease";
    welcomeModal.style.opacity = "0";
    welcomeModal.style.pointerEvents = "none";
    
    setTimeout(() => {
        welcomeModal.classList.add('hidden');
        if (gpsModal) {
            gpsModal.classList.remove('hidden');
        } else {
            triggerNativeGPS();
        }
    }, 800);
};

// FUNGSI UTAMA UNTUK WEBVIEW/APK
function triggerNativeGPS() {
    showToast("Meminta akses lokasi... 📡");

    if (!navigator.geolocation) {
        alert("Device/Browser kau tak support GPS.");
        return;
    }

    const options = {
        enableHighAccuracy: true,
        timeout: 15000, // Tambah masa ke 15 saat untuk APK
        maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
        (position) => {
            currentLatLng = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            
            showToast("Lokasi Berjaya Dikesan! 📍");
            map.setView([currentLatLng.lat, currentLatLng.lng], 18);
            
            // Start Live Tracking
            map.locate({ 
                setView: true, 
                watch: true, 
                maxZoom: 18, 
                enableHighAccuracy: true 
            });
        },
        (error) => {
            // Logik Error yang lebih detail untuk WebView
            let mesej = "";
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    mesej = "Akses Ditolak. Sila 'Allow' GPS dalam setting App/Phone.";
                    break;
                case error.POSITION_UNAVAILABLE:
                    mesej = "Info lokasi tak dapat dikesan. Sila ON GPS Phone.";
                    break;
                case error.TIMEOUT:
                    mesej = "Masa tamat. Signal GPS lemah atau lambat.";
                    break;
                default:
                    mesej = "Ralat GPS: " + error.message;
            }
            alert(mesej);
            console.error("GPS Error:", error);
        },
        options
    );
}

document.getElementById('allowGPS').onclick = () => {
    gpsModal.classList.add('hidden');
    triggerNativeGPS();
};

// ==========================================
// 3. CAMERA LOGIC (BLOB URL)
// ==========================================
const cameraInput = document.getElementById('cameraInput');
const snapBtn = document.getElementById('snapPhoto');

snapBtn.classList.remove('bg-[#FFC3A0]'); 
snapBtn.classList.add('bg-slate-500'); 

snapBtn.onclick = () => cameraInput.click();

cameraInput.onchange = async (event) => {
    const file = event.target.files[0];
    if (file && currentLatLng) {
        const tempImageUrl = URL.createObjectURL(file);
        const timestamp = new Date().toLocaleString('ms-MY');
        
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${currentLatLng.lat}&lon=${currentLatLng.lng}`);
            const data = await res.json();
            const alamat = data.display_name || "Lokasi Cantik";

            const newPhoto = {
                id: Date.now(),
                latlng: [currentLatLng.lat, currentLatLng.lng],
                url: tempImageUrl,
                address: alamat,
                time: timestamp,
                file: file
            };

            photoDataArray.push(newPhoto);
            const marker = addPhotoMarker(newPhoto);
            marker.openPopup();
            addToOffcanvas(newPhoto, marker);
        } catch (err) {
            console.error("Gagal dapat alamat", err);
            showToast("Gagal tarik alamat, check internet!");
        }
    } else if (!currentLatLng) {
        alert("GPS belum lock lokasi lagi, Bro. Tunggu kejap.");
    }
};

// ==========================================
// 4. UI FUNCTIONS
// ==========================================
function addPhotoMarker(photo) {
    const container = document.createElement('div');
    container.className = "p-2 font-sans w-48 text-center";
    container.innerHTML = `
        <img src="${photo.url}" class="rounded-2xl mb-2 w-full h-32 object-cover border-2 border-pink-100 shadow-sm">
        <p class="text-[9px] text-pink-500 font-bold mb-1 italic">${photo.time}</p>
        <p class="text-[10px] text-gray-700 leading-snug mb-3">📍 ${photo.address.split(',').slice(0,3).join(',')}</p>
        <button onclick="saveToDevice('${photo.id}')" class="w-full bg-[#BFFCC6] text-green-700 text-[11px] py-2 rounded-xl font-bold">
            💾 Simpan ke Device
        </button>
    `;

    const marker = L.marker(photo.latlng).addTo(map);
    marker.bindPopup(container, { className: 'custom-popup' });
    return marker;
}

function addToOffcanvas(photo, marker) {
    if (photoDataArray.length === 1) {
        imageList.innerHTML = '';
    }

    const item = document.createElement('div');
    item.className = "bg-pink-50/50 p-3 rounded-[25px] border border-pink-100 mb-4 cursor-pointer hover:bg-pink-100 transition-all flex items-center gap-3";
    item.innerHTML = `
        <img src="${photo.url}" class="w-14 h-14 object-cover rounded-xl shadow-sm">
        <div class="flex-1 overflow-hidden">
            <p class="text-[9px] font-bold text-pink-400">${photo.time}</p>
            <p class="text-[10px] text-gray-500 truncate">${photo.address}</p>
        </div>
    `;
    
    item.onclick = () => {
        offcanvas.classList.add('translate-x-full');
        map.flyTo(photo.latlng, 18, { duration: 1.5 });
        setTimeout(() => marker.openPopup(), 1600);
    };

    imageList.prepend(item);
}

// ==========================================
// 5. UTILITY & DOWNLOAD
// ==========================================
window.saveToDevice = (id) => {
    const photo = photoDataArray.find(p => p.id == id);
    if (photo) {
        const link = document.createElement('a');
        link.href = photo.url;
        link.download = `Smart_WhereAmI_${id}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Gambar masuk muat turun! 📸✨");
    }
};

function showToast(msg) {
    const t = document.createElement('div');
    t.className = "fixed bottom-24 left-1/2 -translate-x-1/2 z-[5000] bg-purple-500 text-white px-6 py-3 rounded-full shadow-2xl font-bold text-sm animate-bounce text-center min-w-[200px]";
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

document.getElementById('openMenu').onclick = () => offcanvas.classList.remove('translate-x-full');
document.getElementById('closeMenu').onclick = () => offcanvas.classList.add('translate-x-full');