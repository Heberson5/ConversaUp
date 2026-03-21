"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { socket } from '@/lib/socket';
import {
  Search, MessageSquare, Loader2, RefreshCw, Eye, LayoutGrid, List,
  Hand, StickyNote, X, Send, User, Plus, FileText, Image as ImageIcon, Smile, Mic, StopCircle, ShieldAlert,
  Trash2, Bold, Italic, Strikethrough, Code, Quote, List as ListIcon, ListOrdered, Download, Camera, Check, Clock, Reply, Zap,
  Headphones, BarChart2, Calendar, TreePine, Coffee, Dribbble, Car, Lightbulb, Hash, Flag, UserPlus, MapPin, Filter, FilterX, Link as LinkIcon, Navigation
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const API_BASE_URL = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) 
  ? process.env.NEXT_PUBLIC_API_URL 
  : 'http://localhost:3001';

// ============================================================================
// TEMA ESCURO
// ============================================================================
const useDarkTheme = () => {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const saved = localStorage.getItem("theme");
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    if (saved === "dark" || (!saved && systemDark)) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("theme")) {
        if (e.matches) root.classList.add("dark");
        else root.classList.remove("dark");
      }
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);
};

// ============================================================================
// GERADOR HTML DO MAPA LEAFLET
// ============================================================================
const getLeafletMapHtml = (lat: number, lng: number, interactive: boolean = false) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>body, html, #map { margin: 0; padding: 0; height: 100%; width: 100%; }</style>
</head>
<body>
    <div id="map"></div>
    <script>
        var map = L.map('map', {
            zoomControl: ${interactive},
            dragging: ${interactive},
            scrollWheelZoom: ${interactive},
            doubleClickZoom: ${interactive}
        }).setView([${lat}, ${lng}], 15);
      
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
        }).addTo(map);
      
        var marker = L.marker([${lat}, ${lng}], {draggable: ${interactive}}).addTo(map);
        ${interactive ? `
        function sendPos(lat, lng) {
            window.parent.postMessage({ type: 'MAP_CLICK', lat: lat, lng: lng }, '*');
        }
      
        map.on('click', function(e) {
            marker.setLatLng(e.latlng);
            sendPos(e.latlng.lat, e.latlng.lng);
        });
      
        marker.on('dragend', function(e) {
            var pos = marker.getLatLng();
            sendPos(pos.lat, pos.lng);
        });
      
        window.addEventListener('message', function(e) {
            if (e.data && e.data.type === 'NEW_POS') {
                marker.setLatLng([e.data.lat, e.data.lng]);
                map.setView([e.data.lat, e.data.lng], 15);
            }
        });
        ` : ''}
    </script>
</body>
</html>
`;

// ============================================================================
// VISUALIZADOR DE ÁUDIO
// ============================================================================
const AudioVisualizer = ({ stream }: { stream: MediaStream | null }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!stream || !canvasRef.current) return;
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext("2d");
    let animationId: number;
    const draw = () => {
      if (!canvasCtx) return;
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height;
        canvasCtx.fillStyle = `rgb(244, 63, 94)`;
        const y = (height - barHeight) / 2;
        canvasCtx.beginPath();
        canvasCtx.roundRect(x, y, barWidth - 2, barHeight || 2, 5);
        canvasCtx.fill();
        x += barWidth;
      }
    };
    draw();
    return () => { cancelAnimationFrame(animationId); audioContext.close(); };
  }, [stream]);
  return <canvas ref={canvasRef} width={180} height={30} className="mx-2" />;
};

// ============================================================================
// COMPONENTE DE SELEÇÃO DE EMOJIS (idêntico ao Chat)
// ============================================================================
const EmojiPicker = ({ onEmojiSelect }: { onEmojiSelect: (emoji: string) => void }) => {
  const [activeTab, setActiveTab] = useState<'emoji' | 'gif'>('emoji');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Smileys e pessoas');
  const [gifSearchTerm, setGifSearchTerm] = useState('');
  const [isSearchingGif, setIsSearchingGif] = useState(false);
  const categoryRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const emojiCategories = {
    "Smileys e pessoas": ["😀","😃","😄","😁","😆","😅","😂","🤣","☺️","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥸","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻","💀","☠️","👽","👾","🤖","🎃","😺","😸","😹","😻","😼","😽","🙀","😿","😾","🤲","👐","🙌","👏","🤝","👍","👎","👊","✊","🤛","🤜","🤞","✌️","🤟","🤘","👌","🤌","🤏","👈","👉","👆","👇","☝️","✋","🤚","🖐","🖖","👋","🤙","💪","🖕","✍️","🙏","🦶","🦵","💄","💋","👄","🦷","👅","👂","👃","👣","👁","👀","🧠","🗣","👤","👥","👶","👧","🧒","👦","👩","🧑","👨","👩‍🦱","👨‍🦱","👩‍🦰","👨‍🦰","👱‍♀️","👱‍♂️","👩‍🦳","👨‍🦳","👩‍🦲","👨‍🦲","👵","🧓","👴","👲","🧕","👮‍♀️","👮‍♂️","👷‍♀️","👷‍♂️","💂‍♀️","💂‍♂️","🕵️‍♀️","🕵️‍♂️","👩‍⚕️","👨‍⚕️","👩‍🌾","👨‍🌾","👩‍🍳","👨‍🍳","👩‍🎓","👨‍🎓","👩‍🎤","👨‍🎤","👩‍🏫","👨‍🏫","👩‍🏭","👨‍🏭","👩‍💻","👨‍💻","👩‍💼","👨‍💼","👩‍🔧","👨‍🔧","👩‍🔬","👨‍🔬","👩‍🎨","👨‍🎨","👩‍🚒","👨‍🚒","👩‍✈️","👨‍✈️","👩‍🚀","👨‍🚀","👩‍⚖️","👨‍⚖️","👸","🤴","🥷","🦸‍♀️","🦸‍♂️","🦹‍♀️","🦹‍♂️","🤶","🎅","🧙‍♀️","🧙‍♂️","🧝‍♀️","🧝‍♂️","🧛‍♀️","🧛‍♂️","🧟‍♀️","🧟‍♂️","🧞‍♀️","🧞‍♂️","🧜‍♀️","🧜‍♂️","🧚‍♀️","🧚‍♂️","👼","🤰","🤱","🙇‍♀️","🙇‍♂️","💁‍♀️","💁‍♂️","🙅‍♀️","🙅‍♂️","🙆‍♀️","🙆‍♂️","🙋‍♀️","🙋‍♂️","🤦‍♀️","🤦‍♂️","🤷‍♀️","🤷‍♂️","🙎‍♀️","🙎‍♂️","🙍‍♀️","🙍‍♂️","💇‍♀️","💇‍♂️","💆‍♀️","💆‍♂️","🧖‍♀️","🧖‍♂️","💅","🤳","💃","🕺","👯‍♀️","👯‍♂️","🕴","🚶‍♀️","🚶‍♂️","🏃‍♀️","🏃‍♂️","🧍‍♀️","🧍‍♂️","👭","👬","👫","💑","💏","👪"],
    "Animais e natureza": ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐽","🐸","🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🐣","🐥","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜","🪰","🪲","🪳","🦟","🦗","🕷","🕸","🦂","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🦭","🐊","🐅","🐆","🦓","🦍","🦧","🦣","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🦬","🐃","🐂","🐄","🐎","🐖","🐏","🐑","🐐","🦌","🐕","🐩","🐈","🐓","🦃","🦚","🦜","🦢","🦩","🕊","🐇","🦝","🦨","🦡","🦫","🦦","🦥","🐁","🐀","🐿","🦔","🐾","🐉","🐲","🌵","🎄","🌲","🌳","🌴","🪵","🌱","🌿","☘️","🍀","🎍","🪴","🎋","🍃","🍂","🍁","🍄","🐚","🪸","🪨","🌾","💐","🌷","🌹","🥀","🌺","🌸","🌼","🌻","🌞","🌝","🌛","🌜","🌚","🌕","🌖","🌗","🌘","🌑","🌒","🌓","🌔","🌙","🌎","🌍","🌏","🪐","💫","⭐️","🌟","✨","⚡️","☄️","💥","🔥","🌪","🌈","☀️","🌤","⛅️","🌥","☁️","🌦","🌧","⛈","🌩","🌨","❄️","☃️","⛄️","🌬","💨","💧","💦","🌊"],
    "Comida e bebida": ["🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶","🫑","🌽","🥕","🧄","🧅","🥔","🍠","🥐","🥯","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🦴","🌭","🍔","🍟","🍕","🫓","🥪","🥙","🧆","🌮","🌯","🫔","🥗","🥘","🫕","🥫","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧","🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜","🍯","🥛","🍼","☕️","🫖","🍵","🧃","🥤","🧋","🍶","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🧉","🍾","🧊","🥄","🍴","🥣","🥡","🥢","🧂"],
    "Viagens e lugares": ["✈️","🚂","🚆","🚇","🚈","🚉","🚊","🚝","🚞","🚋","🚃","🚄","🚅","🚈","🚇","🚆","🚂","✈️","🛫","🛬","🛩","💺","🛰","🚀","🛸","🚁","🛶","⛵️","🚤","🛳","⛴","🛥","🚢","⚓️","🛟","🧭","🗺","🏔","⛰","🌋","🗻","🏕","🏖","🏜","🏝","🏞","🏟","🏛","🏗","🧱","🏘","🏚","🏠","🏡","🏢","🏣","🏤","🏥","🏦","🏨","🏩","🏪","🏫","🏬","🏭","🏯","🏰","💒","🗼","🗽","⛪","🕍","🕋","⛲","⛺","🌁","🌃","🏙","🌄","🌅","🌆","🌇","🌉","♨️","🎠","🎡","🎢","💈","🎪","🚂","🚃","🚄","🚅","🚆","🚇","🚈","🚉","🚊","🚝","🚞","🚋","🚌","🚍","🚎","🚐","🚑","🚒","🚓","🚔","🚕","🚖","🚗","🚘","🚙","🚚","🚛","🚜","🚲","🛴","🛵","🛺","🚏","🛣","🛤","⛽","🚨","🚥","🚦","🚧","⚓","⛵","🛶","🚤","🛳","⛴","🛥","🚢","✈","🛩","🛫","🛬","🪂","💺","🚁","🚟","🚠","🚡","🛰","🚀","🛸","🪐","🌟","⛱","🎑","🏞","🌅","🌄","🌇","🌆","🏙","🌃","🌌","🌉","🌁"],
    "Objetos e Bandeiras": ["⌚️","📱","📲","💻","⌨️","🖥","🖨","🖱","🖲","🕹","🗜","💽","💾","💿","📀","📼","📷","📸","📹","🎥","📽","🎞","📞","☎️","📟","📠","📺","📻","🎙","🎚","🎛","🧭","⏱","⏲","⏰","🕰","⌛️","⏳","📡","🔋","🔌","💡","🔦","🕯","🪔","🧯","🛢","💸","💵","💴","💶","💷","💰","💳","💎","⚖️","🪜","🧰","🪛","🔧","🔨","⚒","🛠","⛏","🪚","🔩","⚙️","🧱","⛓","🧲","🔫","💣","🧨","🪓","🔪","🗡","⚔️","🛡","🚬","⚰️","⚱️","🏺","🔮","📿","🧿","💈","⚗️","🔭","🔬","🕳","🩹","🩺","💊","💉","🩸","🧬","🦠","🧫","🧪","🌡","🧹","🪠","🧺","🧻","🚽","🚰","🚿","🛁","🛀","🧼","🪥","🪒","🧽","🪣","🧴","🛎","🔑","🗝","🚪","🪑","🛋","🛏","🛌","🧸","🪆","🖼","🪞","🪟","🛍","🛒","🎁","🎈","🎏","🎀","🪄","🎊","🎉","🎎","🏮","🎐","🧧","✉️","📩","📨","📧","💌","📥","📤","📦","🏷","📪","📫","📬","📭","📮","📯","📜","📃","📄","📑","🧾","📊","📈","📉","🗒","🗓","📆","📅","🗑","📇","🗃","🗳","🗄","📋","📁","📂","🗂","🗞","📰","📓","📔","📒","📕","📗","📘","📙","📚","📖","🔖","🧷","🔗","📎","🖇","📐","📏","🧮","📌","📍","✂️","🖊","🖋","✒️","🖌","🖍","📝","✏️","🔍","🔎","🔏","🔐","🔒","🔓"],
    "Símbolos": ["❤️","🧡","💛","💚","💙","💜","🤎","🖤","🤍","💔","❤️‍🔥","❤️‍🩹","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉","☸️","✡️","🔯","🕎","☯️","☦️","🛐","⛎","♈️","♉️","♊️","♋️","♌️","♍️","♎️","♏️","♐️","♑️","♒️","♓️","🆔","⚛️","🉑","☢️","☣️","📴","📳","🈶","🈚️","🈸","🈺","🈷️","✴️","🆚","💮","🉐","㊙️","㊗️","🈴","🈵","🈹","🈲","🅰️","🅱️","🆎","🆑","🅾️","🆘","❌","⭕️","🛑","⛔️","📛","🚫","💯","💢","♨️","🚷","🚯","🚳","🚱","🔞","📵","🚭","❗️","❕","❓","❔","‼️","⁉️","🔅","🔆","〽️","⚠️","🚸","🔱","⚜️","🔰","♻️","✅","🈯️","💹","❇️","✳️","❎","🌐","💠","Ⓜ️","🌀","💤","🏧","🚾","♿️","🅿️","🛗","🈳","🈂️","🛂","🛃","🛄","🛅","🚹","🚺","🚼","⚧","🚻","🚮","🎦","📶","🈁","🔣","ℹ️","🔤","🔡","🔠","🆖","🆗","🆙","🆒","🆕","🆓","0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟","🔢","#️⃣","*️⃣","⏏️","▶️","⏸","⏯","⏹","⏺","⏭","⏮","⏩","⏪","⏫","⏬","◀️","🔼","🔽","➡️","⬅️","⬆️","⬇️","↗️","↘️","↙️","↖️","↕️","↔️","↪️","↩️","⤴️","⤵️","🔀","🔁","🔂","🔄","🔃","🎵","🎶","➕","➖","➗","✖️","♾","💲","💱","™️","©️","®️","👁‍🗨","🔚","🔙","🔛","🔝","🔜","〰️","➰","➿","✔️","☑️","🔘","🔴","🟠","🟡","🟢","🔵","🟣","⚫️","⚪️","🟤","🔺","🔻","🔸","🔹","🔶","🔷","🔳","🔲","▪️","▫️","◾️","◽️","◼️","◻️","🟥","🟧","🟨","🟩","🟦","🟪","🟫","⬛️","⬜️","🔈","🔇","🔉","🔊","🔔","🔕","📣","📢","💬","💭","🗯","♠️","♣️","♥️","♦️","🃏","🎴","🀄️"]
  };
  const [mockGifs, setMockGifs] = useState<any[]>([]);
  useEffect(() => {
    if (activeTab === 'gif' && mockGifs.length === 0 && !gifSearchTerm) {
      loadTrendingGifs();
    }
  }, [activeTab]);
  const loadTrendingGifs = async () => {
    setIsSearchingGif(true);
    try {
      const apiKey = "GlVGYHqc3SyXX10vX064UqW8n2d7O7pY";
      const res = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=20&rating=g`);
      const data = await res.json();
      if (data && data.data) {
        setMockGifs(data.data.map((g: any) => ({ url: g.images.fixed_height.url })));
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar GIFs populares");
    }
    setIsSearchingGif(false);
  };
  const handleGifSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gifSearchTerm.trim()) {
      loadTrendingGifs();
      return;
    }
    setIsSearchingGif(true);
    try {
      const apiKey = "GlVGYHqc3SyXX10vX064UqW8n2d7O7pY";
      const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(gifSearchTerm)}&limit=30&rating=g`);
      const data = await res.json();
      if (data && data.data) {
        setMockGifs(data.data.map((g: any) => ({ url: g.images.fixed_height.url })));
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao buscar GIFs");
    }
    setIsSearchingGif(false);
  };
  const filteredEmojis = (category: string[]) => {
    if (!searchTerm) return category;
    return category.filter(emoji => emoji.includes(searchTerm));
  };
  const scrollToCategory = (cat: string) => {
    setActiveCategory(cat);
    if (categoryRefs.current[cat] && scrollContainerRef.current) {
      categoryRefs.current[cat]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const containerTop = scrollContainerRef.current.scrollTop;
  
    let newActiveCategory = activeCategory;
    for (const cat of Object.keys(emojiCategories)) {
      const el = categoryRefs.current[cat];
      if (el) {
        if (el.offsetTop - scrollContainerRef.current.offsetTop <= containerTop + 20) {
          newActiveCategory = cat;
        }
      }
    }
    if (newActiveCategory !== activeCategory) {
      setActiveCategory(newActiveCategory);
    }
  };
  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#111b21] text-slate-900 dark:text-[#d1d7db] emoji-picker-container rounded-xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-around items-center p-2 bg-slate-50 dark:bg-[#202c33] border-b border-slate-200 dark:border-slate-800/60 relative">
        <button onClick={() => scrollToCategory('Smileys e pessoas')} className={cn("p-1.5 transition-colors relative", activeCategory === 'Smileys e pessoas' ? "text-[#00a884]" : "text-[#8696a0] hover:text-[#d1d7db]")}>
          <Smile size={20}/>
          {activeCategory === 'Smileys e pessoas' && <div className="absolute -bottom-2 left-0 w-full h-1 bg-[#00a884] rounded-t-md"></div>}
        </button>
        <button onClick={() => scrollToCategory('Animais e natureza')} className={cn("p-1.5 transition-colors relative", activeCategory === 'Animais e natureza' ? "text-[#00a884]" : "text-[#8696a0] hover:text-[#d1d7db]")}>
          <TreePine size={20}/>
          {activeCategory === 'Animais e natureza' && <div className="absolute -bottom-2 left-0 w-full h-1 bg-[#00a884] rounded-t-md"></div>}
        </button>
        <button onClick={() => scrollToCategory('Comida e bebida')} className={cn("p-1.5 transition-colors relative", activeCategory === 'Comida e bebida' ? "text-[#00a884]" : "text-[#8696a0] hover:text-[#d1d7db]")}>
          <Coffee size={20}/>
          {activeCategory === 'Comida e bebida' && <div className="absolute -bottom-2 left-0 w-full h-1 bg-[#00a884] rounded-t-md"></div>}
        </button>
        <button onClick={() => scrollToCategory('Viagens e lugares')} className={cn("p-1.5 transition-colors relative", activeCategory === 'Viagens e lugares' ? "text-[#00a884]" : "text-[#8696a0] hover:text-[#d1d7db]")}>
          <Car size={20}/>
          {activeCategory === 'Viagens e lugares' && <div className="absolute -bottom-2 left-0 w-full h-1 bg-[#00a884] rounded-t-md"></div>}
        </button>
        <button onClick={() => scrollToCategory('Objetos e Bandeiras')} className={cn("p-1.5 transition-colors relative", activeCategory === 'Objetos e Bandeiras' ? "text-[#00a884]" : "text-[#8696a0] hover:text-[#d1d7db]")}>
          <Flag size={20}/>
          {activeCategory === 'Objetos e Bandeiras' && <div className="absolute -bottom-2 left-0 w-full h-1 bg-[#00a884] rounded-t-md"></div>}
        </button>
        <button onClick={() => scrollToCategory('Símbolos')} className={cn("p-1.5 transition-colors relative", activeCategory === 'Símbolos' ? "text-[#00a884]" : "text-[#8696a0] hover:text-[#d1d7db]")}>
          <Hash size={20}/>
          {activeCategory === 'Símbolos' && <div className="absolute -bottom-2 left-0 w-full h-1 bg-[#00a884] rounded-t-md"></div>}
        </button>
      </div>
      {activeTab === 'emoji' && (
        <div className="p-2 pt-3">
          <div className="relative bg-slate-100 dark:bg-[#202c33] rounded-full flex items-center px-3 py-1.5">
            <Search size={16} className="text-slate-400 dark:text-[#8696a0] mr-2" />
            <input
              type="text"
              placeholder="Pesquisar emoji"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent w-full outline-none text-sm text-slate-900 dark:text-[#d1d7db] placeholder-slate-500 dark:placeholder-[#8696a0]"
            />
          </div>
        </div>
      )}
      {activeTab === 'gif' && (
        <form onSubmit={handleGifSearch} className="p-2 pt-3 flex items-center gap-2">
          <div className="relative bg-slate-100 dark:bg-[#202c33] rounded-full flex items-center px-3 py-1.5 flex-1">
            <Search size={16} className="text-slate-400 dark:text-[#8696a0] mr-2" />
            <input
              type="text"
              placeholder="Buscar Giphy"
              value={gifSearchTerm}
              onChange={(e) => setGifSearchTerm(e.target.value)}
              className="bg-transparent w-full outline-none text-sm text-slate-900 dark:text-[#d1d7db] placeholder-slate-500 dark:placeholder-[#8696a0]"
            />
          </div>
        </form>
      )}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 custom-scrollbar"
        style={{ fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif' }}
      >
        {activeTab === 'emoji' && (
          <>
            {Object.entries(emojiCategories).map(([cat, emojis]) => {
              const filtered = filteredEmojis(emojis);
              if (filtered.length === 0) return null;
              return (
                <div key={cat} className="mb-4" ref={el => { categoryRefs.current[cat] = el; }}>
                  <div className="text-sm font-semibold text-slate-500 dark:text-[#8696a0] mb-2 px-1 sticky top-0 bg-white/90 dark:bg-[#111b21]/90 backdrop-blur-sm z-10 py-1">{cat}</div>
                  <div className="grid grid-cols-8 gap-1">
                    {filtered.map((emoji, i) => (
                      <button
                        key={i}
                        onClick={() => onEmojiSelect(emoji)}
                        className="text-3xl w-full aspect-square flex items-center justify-center hover:bg-slate-100 dark:hover:bg-[#202c33] rounded-lg transition active:scale-90"
                        style={{ fontFamily: '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif' }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
        {activeTab === 'gif' && (
          <div className="grid grid-cols-2 gap-2 p-2">
            {isSearchingGif ? (
              <div className="col-span-2 flex justify-center py-10 opacity-50"><Loader2 className="animate-spin text-[#00a884]" /></div>
            ) : mockGifs.length > 0 ? (
              mockGifs.map((gif, i) => (
                <img key={i} src={gif.url} alt="gif" onClick={() => { onEmojiSelect(` ${gif.url} `); toast.success("GIF anexado à mensagem"); }} className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition bg-slate-200 dark:bg-slate-800" />
              ))
            ) : (
              <div className="col-span-2 text-center text-slate-500 dark:text-slate-400 py-10 text-sm">
                Nenhum GIF encontrado.
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex bg-slate-50 dark:bg-[#202c33] justify-center gap-10 py-2 border-t border-slate-200 dark:border-slate-800/60">
        <button
          onClick={() => setActiveTab('emoji')}
          className={cn("p-1.5 px-4 rounded-full transition-colors flex items-center justify-center", activeTab === 'emoji' ? "bg-slate-200 dark:bg-[#374248] text-slate-700 dark:text-[#00a884]" : "text-slate-500 dark:text-[#8696a0] hover:text-slate-700 dark:hover:text-[#d1d7db]")}
        >
          <Smile size={24} />
        </button>
        <button
          onClick={() => setActiveTab('gif')}
          className={cn("p-1.5 px-4 rounded-full transition-colors flex items-center justify-center font-bold text-lg", activeTab === 'gif' ? "bg-slate-200 dark:bg-[#374248] text-slate-700 dark:text-[#00a884]" : "text-slate-500 dark:text-[#8696a0] hover:text-slate-700 dark:hover:text-[#d1d7db]")}
        >
          GIF
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// QUICK REPLIES
// ============================================================================
const QuickReplies = ({ onSelect }: { onSelect: (text: string) => void }) => {
  const [replies, setReplies] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('quick_replies');
    return saved ? JSON.parse(saved) : [
      "Olá, como posso ajudar?",
      "Aguarde um momento, por favor.",
      "Obrigado pelo contato!",
      "Estarei transferindo para o setor responsável.",
      "Ok, entendi."
    ];
  });
  return (
    <div className="absolute bottom-[80px] left-4 bg-white dark:bg-[#111b21] rounded-xl shadow-2xl w-[320px] max-h-[400px] flex flex-col z-50 border border-slate-200 dark:border-slate-800 overflow-hidden animate-in slide-in-from-bottom-5 origin-bottom-left quick-replies-container">
      <div className="p-3 bg-slate-50 dark:bg-[#202c33] border-b border-slate-200 dark:border-slate-800/60 font-bold text-sm flex justify-between items-center text-slate-900 dark:text-[#d1d7db]">
        <div className="flex items-center gap-2"><Zap size={16} className="text-amber-500"/> Respostas Rápidas</div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {replies.length === 0 && <div className="text-center p-4 text-sm text-slate-500">Nenhuma resposta cadastrada.</div>}
        {replies.map((reply, index) => (
          <div key={index} className="group flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-[#202c33] rounded-lg mb-1 transition-colors cursor-pointer" onClick={() => onSelect(reply)}>
            <button className="flex-1 text-left text-sm truncate text-slate-800 dark:text-[#d1d7db]">
              {reply}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

type ChatType = {
  id: string;
  name: string;
  lastMessage?: string;
  time?: string;
  timestamp?: number;
  unread?: number;
  agent?: string;
  department?: string;
  connectionId?: string;
  connectionName?: string;
  connectionColor?: string;
  picUrl?: string;
  number?: string;
  [key: string]: any
};

type MessageType = {
  id?: string;
  text?: string;
  body?: string;
  type?: string;
  mimetype?: string;
  caption?: string;
  sender?: string;
  fromMe?: boolean;
  timestamp?: any;
  ack?: number;
  isSticker?: boolean;
  poll?: { question: string; options: string[]; allowMultipleAnswers: boolean };
  event?: { name: string; description: string; date: string };
  contact?: { name: string; number: string };
  location?: { lat: number; lng: number; address: string };
  quotedMsg?: { body: string; id: string; type: string; sender?: string };
  vcard?: string;
  reaction?: string;
  hasMedia?: boolean;
  mediaLoading?: boolean;
  mediaLoaded?: boolean;
  filename?: string;
  url?: string;
  [key: string]: any;
};

const Management = () => {
  useDarkTheme();

  const [chats, setChats] = useState<ChatType[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterConnection, setFilterConnection] = useState('');
  const [activeAdminChat, setActiveAdminChat] = useState<ChatType | null>(null);
  const [chatMessages, setChatMessages] = useState<MessageType[]>([]);
  const [adminMessage, setAdminMessage] = useState("");
  const [isInterfering, setIsInterfering] = useState(false);
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [isQuickRepliesOpen, setIsQuickRepliesOpen] = useState(false);
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [locationData, setLocationData] = useState({ lat: -23.550520, lng: -46.633308, address: "Buscando localização..." });
  const [locSearchQuery, setLocSearchQuery] = useState('');
  const [locSearchResults, setLocSearchResults] = useState<any[]>([]);
  const [isLocSearching, setIsLocSearching] = useState(false);
  const [initialMapHtml, setInitialMapHtml] = useState("");
  const mapIframeRef = useRef<HTMLIFrameElement>(null);
  const [contactSearch, setContactSearch] = useState('');
  const [pollForm, setPollForm] = useState({ question: '', options: ['', ''], allowMultipleAnswers: true });
  const [eventForm, setEventForm] = useState({ name: '', description: '', date: '' });
  const [mockContacts] = useState([
    { name: 'João Silva (Cliente VIP)', number: '+55 11 99999-1111' },
    { name: 'Maria Souza (Suporte Técnico)', number: '+55 11 98888-2222' },
    { name: 'Financeiro Corp.', number: '+55 11 3333-4444' },
    { name: 'Carlos Andrade (Logística)', number: '+55 11 97777-3333' },
    { name: 'Ana Paula (Fornecedor)', number: '+55 11 96666-5555' },
    { name: 'Lucas Mendes (Diretoria)', number: '+55 11 95555-6666' }
  ]);
  const filteredModalContacts = mockContacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.number.includes(contactSearch));
  const [replyingTo, setReplyingTo] = useState<MessageType | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const activeChatRef = useRef<ChatType | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);

  const [isReactionOpen, setIsReactionOpen] = useState(false);
  const [messageForReaction, setMessageForReaction] = useState<string | null>(null);

  // ==========================================================================
  // CACHE DE MENSAGENS (PERSISTENTE EM LOCALSTORAGE)
  // ==========================================================================
  const messagesCache = useRef<Record<string, MessageType[]>>({});
  const loadingChats = useRef<Set<string>>(new Set());

  // Função para sanitizar mensagem antes de salvar (remover base64 de mídia)
  const sanitizeForStorage = (msg: MessageType): MessageType => {
    if (msg.hasMedia && msg.body && (msg.body.startsWith('data:') || msg.body.length > 1000)) {
      const { body, ...rest } = msg;
      return { ...rest, body: undefined, mediaStored: false };
    }
    return msg;
  };

  // Função para carregar mensagens do localStorage para um chat
  const loadFromLocalStorage = (chatId: string, connectionId?: string): MessageType[] | null => {
    const key = `chat_messages_${connectionId || 'default'}_${chatId}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const msgs = JSON.parse(stored);
        return msgs.map((m: any) => ({ ...m, mediaLoading: false, mediaLoaded: false }));
      }
    } catch (e) {
      console.error("Erro ao ler localStorage:", e);
    }
    return null;
  };

  // Salvar mensagens no localStorage com limite e sanitização
  const saveToLocalStorage = (chatId: string, connectionId: string | undefined, messages: MessageType[]) => {
    const key = `chat_messages_${connectionId || 'default'}_${chatId}`;
    try {
      const limitedMessages = messages.slice(-500);
      const sanitized = limitedMessages.map(sanitizeForStorage);
      localStorage.setItem(key, JSON.stringify(sanitized));
    } catch (e) {
      console.error("Erro ao salvar localStorage:", e);
      if (e.name === 'QuotaExceededError') {
        try {
          const keys = Object.keys(localStorage);
          for (const k of keys) {
            if (k.startsWith('chat_messages_')) {
              localStorage.removeItem(k);
              break;
            }
          }
          const limited = messages.slice(-200);
          const sanitized = limited.map(sanitizeForStorage);
          localStorage.setItem(key, JSON.stringify(sanitized));
        } catch (e2) {
          console.error("Falha ao liberar espaço no localStorage", e2);
        }
      }
    }
  };

  // ==========================================================================
  // ESTADO PARA CONEXÕES (dropdown)
  // ==========================================================================
  const [availableConnections, setAvailableConnections] = useState<{ id: string; name: string; color: string; status: string; enabled: boolean }[]>([]);
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, { status: string; enabled: boolean }>>({});

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/connections`);
        const data = await res.json();
        setAvailableConnections(data);
        const statusMap: Record<string, { status: string; enabled: boolean }> = {};
        data.forEach((c: any) => { statusMap[c.id] = { status: c.status, enabled: c.enabled }; });
        setConnectionStatuses(statusMap);
      } catch (error) {
        console.error('Erro ao buscar conexões:', error);
      }
    };
    fetchConnections();

    const handleConnectionStatus = ({ connectionId, status, enabled }: { connectionId: string; status: string; enabled: boolean }) => {
      setConnectionStatuses(prev => ({ ...prev, [connectionId]: { status, enabled } }));
    };
    socket.on('connection:status', handleConnectionStatus);
    return () => { socket.off('connection:status', handleConnectionStatus); };
  }, []);

  // ==========================================================================
  // CARREGAR MENSAGENS DO LOCALSTORAGE PARA TODOS OS CHATS QUANDO A LISTA MUDAR
  // ==========================================================================
  useEffect(() => {
    if (chats.length === 0) return;
    chats.forEach(chat => {
      if (!messagesCache.current[chat.id]) {
        const stored = loadFromLocalStorage(chat.id, chat.connectionId);
        if (stored) {
          messagesCache.current[chat.id] = stored;
        }
      }
    });
  }, [chats]);

  // ==========================================================================
  // CARREGAR MENSAGENS EM SEGUNDO PLANO PARA TODOS OS CHATS
  // ==========================================================================
  useEffect(() => {
    if (chats.length === 0) return;
    const timeoutId = setTimeout(() => {
      chats.forEach(chat => {
        const chatId = chat.id;
        if (loadingChats.current.has(chatId) || messagesCache.current[chatId]) return;
        loadingChats.current.add(chatId);
        socket.emit("get_chat_messages", { chatId, connectionId: chat.connectionId });
      });
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [chats]);

  // ==========================================================================
  // BUSCAR MÍDIA SOB DEMANDA (igual ao Chat.tsx)
  // ==========================================================================
  const fetchMedia = useCallback((messageId: string, chatId: string, connectionId?: string) => {
    console.log(`🔍 fetchMedia chamado para mensagem ${messageId} do chat ${chatId} (conexão ${connectionId})`);
    return new Promise((resolve, reject) => {
      socket.emit("get_media", { chatId, messageId, connectionId }, (response: any) => {
        if (response.success) {
          console.log(`✅ fetchMedia sucesso para ${messageId}`, response);
          resolve(response);
        } else {
          console.error(`❌ fetchMedia erro para ${messageId}:`, response.error);
          reject(response.error);
        }
      });
    });
  }, []);

  // Atualizar mensagem no estado com mídia baixada e persistir no localStorage
  const updateMessageWithMedia = useCallback((chatId: string, messageId: string, mediaData: any) => {
    if (messagesCache.current[chatId]) {
      messagesCache.current[chatId] = messagesCache.current[chatId].map(msg => 
        msg.id === messageId ? { 
          ...msg, 
          body: mediaData.media, 
          mimetype: mediaData.mimetype, 
          filename: mediaData.filename, 
          mediaLoaded: true 
        } : msg
      );
      const conn = chats.find(c => c.id === chatId);
      if (conn) saveToLocalStorage(chatId, conn.connectionId, messagesCache.current[chatId]);
    }
    
    if (activeChatRef.current?.id === chatId) {
      setChatMessages(prev => 
        prev.map(msg => msg.id === messageId ? { 
          ...msg, 
          body: mediaData.media, 
          mimetype: mediaData.mimetype, 
          filename: mediaData.filename, 
          mediaLoaded: true 
        } : msg)
      );
    }
  }, [chats]);

  // ==========================================================================
  // RECEBER MENSAGENS DO SERVIDOR (atualiza cache e persistência)
  // ==========================================================================
  useEffect(() => {
    const handleChatMessages = (data: any) => {
      let msgs = data?.messages || [];
      const chatId = data.chatId;
      if (!chatId) return;

      // Remove duplicatas
      const uniqueMessages = msgs.reduce((acc: MessageType[], curr: MessageType) => {
        if (!acc.some(msg => msg.id === curr.id)) {
          acc.push(curr);
        }
        return acc;
      }, []);

      const msgsWithFlags = uniqueMessages.map((msg: any) => ({ ...msg, mediaLoading: false, mediaLoaded: false }));

      // Atualiza cache
      if (messagesCache.current[chatId]) {
        const existing = messagesCache.current[chatId];
        const merged = [...existing, ...msgsWithFlags];
        const final = merged.filter((msg, index, self) => self.findIndex(m => m.id === msg.id) === index);
        final.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        messagesCache.current[chatId] = final;
      } else {
        messagesCache.current[chatId] = msgsWithFlags;
      }

      // Persiste no localStorage
      const chat = chats.find(c => c.id === chatId);
      if (chat) saveToLocalStorage(chatId, chat.connectionId, messagesCache.current[chatId]);

      // Se for o chat ativo, atualiza a interface
      if (activeChatRef.current?.id === chatId) {
        setChatMessages(messagesCache.current[chatId]);
        setIsLoadingMessages(false);
      }
      loadingChats.current.delete(chatId);
    };

    const handleNewMessage = (data: any) => {
      const chatKey = data.chatId || data.from || data.to;
      if (!chatKey) return;

      const msgWithFlags = { ...data, mediaLoading: false, mediaLoaded: false };
      if (!messagesCache.current[chatKey]) messagesCache.current[chatKey] = [];

      if (!msgWithFlags.id || !messagesCache.current[chatKey].some(m => m.id === msgWithFlags.id)) {
        messagesCache.current[chatKey].push(msgWithFlags);
        messagesCache.current[chatKey].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        const chat = chats.find(c => c.id === chatKey);
        if (chat) saveToLocalStorage(chatKey, chat.connectionId, messagesCache.current[chatKey]);
      }

      if (activeChatRef.current?.id === chatKey) {
        setChatMessages([...messagesCache.current[chatKey]]);
      } else {
        setChats(prev => prev.map(c => c.id === chatKey && !data.fromMe ? { ...c, unread: (c.unread || 0) + 1 } : c));
      }
    };

    socket.on("chat_messages", handleChatMessages);
    socket.on("receive_message", handleNewMessage);
    socket.on("chat_messages_error", (data: any) => {
      if (data.chatId === activeChatRef.current?.id) {
        toast.error("Erro ao carregar mensagens. Tente novamente.");
        setIsLoadingMessages(false);
      }
      loadingChats.current.delete(data.chatId);
    });

    return () => {
      socket.off("chat_messages", handleChatMessages);
      socket.off("receive_message", handleNewMessage);
      socket.off("chat_messages_error");
    };
  }, [chats]);

  // ==========================================================================
  // EVENTOS DE LISTA DE CHATS (com deduplicação)
  // ==========================================================================
  useEffect(() => {
    const handleChats = (data: ChatType[]) => {
      const filtered = (data || []).filter(c => c && c.id && !c.id.includes('status@') && !c.id.includes('@broadcast') && !c.isGroup);
      setChats(prev => {
        // Combinar chats existentes com novos
        const combined = [...prev, ...filtered];
        // Remover duplicatas por id
        const unique = combined.filter((c, idx, self) => self.findIndex(t => t.id === c.id) === idx);
        // Preservar agentes existentes
        const result = unique.map(newChat => {
          const existing = prev.find(p => p.id === newChat.id);
          return {
            ...newChat,
            agent: existing?.agent || newChat.agent,
          };
        });
        return result;
      });
      setIsLoading(false);
    };

    socket.on('chats', handleChats);

    if (socket.connected) socket.emit('get_chats', { limit: 30 });
    else socket.once('connect', () => socket.emit('get_chats', { limit: 30 }));

    return () => {
      socket.off('chats', handleChats);
    };
  }, []);

  // ==========================================================================
  // GERENCIAR MENSAGENS DO CHAT ATIVO
  // ==========================================================================
  useEffect(() => {
    if (activeAdminChat) {
      setChatMessages([]);
      setIsInterfering(false);
      setIsNoteMode(false);
      setIsLoadingMessages(true);

      if (messagesCache.current[activeAdminChat.id]) {
        setChatMessages(messagesCache.current[activeAdminChat.id]);
        setIsLoadingMessages(false);
      } else {
        if (!loadingChats.current.has(activeAdminChat.id)) {
          loadingChats.current.add(activeAdminChat.id);
          socket.emit("get_chat_messages", { chatId: activeAdminChat.id, connectionId: activeAdminChat.connectionId });
        }
      }

      if (!activeAdminChat.picUrl && !activeAdminChat.profilePicUrl && !activeAdminChat.profilePic) {
        socket.emit("request_profile_pic", { id: activeAdminChat.id });
      }

      const handleProfilePicUpdate = (data: { id: string; picUrl: string }) => {
        if (data.id === activeAdminChat.id) {
          setActiveAdminChat(prev => prev ? { ...prev, picUrl: data.picUrl } : null);
          setChats(prev => prev.map(c => c.id === data.id ? { ...c, picUrl: data.picUrl } : c));
        }
      };
      socket.on('profile_pic_update', handleProfilePicUpdate);

      const handleMessageAck = (data: { id: string; chatId: string; ack: number }) => {
        if (activeChatRef.current && data.chatId === activeChatRef.current.id) {
          setChatMessages(prev =>
            prev.map(msg => (msg.id === data.id ? { ...msg, ack: data.ack } : msg))
          );
          if (messagesCache.current[data.chatId]) {
            messagesCache.current[data.chatId] = messagesCache.current[data.chatId].map(msg =>
              msg.id === data.id ? { ...msg, ack: data.ack } : msg
            );
            const chat = chats.find(c => c.id === data.chatId);
            if (chat) saveToLocalStorage(data.chatId, chat.connectionId, messagesCache.current[data.chatId]);
          }
        }
      };

      const handleInternalNote = (data: any) => {
        if (data.chatId === activeChatRef.current?.id) {
          const noteMsg = { id: Date.now().toString(), text: data.text, sender: 'system_note' };
          setChatMessages(prev => [...prev, noteMsg]);
          if (messagesCache.current[data.chatId]) {
            messagesCache.current[data.chatId].push(noteMsg);
            const chat = chats.find(c => c.id === data.chatId);
            if (chat) saveToLocalStorage(data.chatId, chat.connectionId, messagesCache.current[data.chatId]);
          }
        }
      };

      const handleMessageReaction = (data: { messageId: string; chatId: string; reaction: string; fromMe: boolean }) => {
        if (activeChatRef.current && data.chatId === activeChatRef.current.id) {
          setChatMessages(prev =>
            prev.map(msg =>
              msg.id === data.messageId ? { ...msg, reaction: data.reaction } : msg
            )
          );
          if (messagesCache.current[data.chatId]) {
            messagesCache.current[data.chatId] = messagesCache.current[data.chatId].map(msg =>
              msg.id === data.messageId ? { ...msg, reaction: data.reaction } : msg
            );
            const chat = chats.find(c => c.id === data.chatId);
            if (chat) saveToLocalStorage(data.chatId, chat.connectionId, messagesCache.current[data.chatId]);
          }
        }
      };

      socket.on("message_ack_update", handleMessageAck);
      socket.on("new_internal_note", handleInternalNote);
      socket.on("message_reaction", handleMessageReaction);

      return () => {
        socket.off("profile_pic_update", handleProfilePicUpdate);
        socket.off("message_ack_update", handleMessageAck);
        socket.off("new_internal_note", handleInternalNote);
        socket.off("message_reaction", handleMessageReaction);
      };
    }
  }, [activeAdminChat, chats]);

  // Atualiza a ref do chat ativo
  useEffect(() => { activeChatRef.current = activeAdminChat; }, [activeAdminChat]);

  // Auto-scroll para o final quando novas mensagens chegam
  useEffect(() => {
    if (scrollRef.current && !isLoadingMessages) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, isLoadingMessages]);

  // ==========================================================================
  // AÇÕES DO USUÁRIO
  // ==========================================================================
  const toggleInterference = () => {
    if (!activeAdminChat) return;
    const newState = !isInterfering;
    setIsInterfering(newState);
    socket.emit("interfere_chat", { chatId: activeAdminChat.id, isBlocked: newState });
    toast.info(newState ? "Agente bloqueado. Você pode enviar mensagens." : "Agente desbloqueado.");
  };

  const canSend = isInterfering || isNoteMode;

  const [agentName, setAgentName] = useState<string>("Agente");
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedName = localStorage.getItem('user_display_name');
      if (storedName) setAgentName(storedName);
    }
  }, []);

  const handleSendAdminMessage = () => {
    if (!adminMessage.trim() || !activeAdminChat) return;
    if (!canSend) return;

    const tempMsg: MessageType = {
      id: Date.now().toString(),
      body: adminMessage,
      sender: 'agent',
      timestamp: Math.floor(Date.now() / 1000),
      fromMe: true,
      ack: 1,
      quotedMsg: replyingTo ? {
        body: replyingTo.body || replyingTo.caption || "Mídia",
        id: replyingTo.id || "",
        type: replyingTo.type || "chat",
        sender: replyingTo.sender
      } : undefined
    };

    if (isNoteMode) {
      socket.emit("internal_note", { chatId: activeAdminChat.id, text: adminMessage });
      const noteMsg = { id: Date.now().toString(), text: adminMessage, sender: 'system_note' };
      setChatMessages(prev => [...prev, noteMsg]);
      if (messagesCache.current[activeAdminChat.id]) {
        messagesCache.current[activeAdminChat.id].push(noteMsg);
        saveToLocalStorage(activeAdminChat.id, activeAdminChat.connectionId, messagesCache.current[activeAdminChat.id]);
      }
    } else {
      setChats(prev => prev.map(c => c.id === activeAdminChat.id ? { ...c, agent: agentName } : c));
      if (activeAdminChat) activeAdminChat.agent = agentName;

      socket.emit("send_message", {
        to: activeAdminChat.id,
        text: adminMessage,
        quotedMsgId: replyingTo?.id,
        quotedMsg: replyingTo
      });
      setChatMessages(prev => [...prev, tempMsg]);
      if (messagesCache.current[activeAdminChat.id]) {
        messagesCache.current[activeAdminChat.id].push(tempMsg);
        saveToLocalStorage(activeAdminChat.id, activeAdminChat.connectionId, messagesCache.current[activeAdminChat.id]);
      }

      setChats(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(c => c.id === activeAdminChat.id);
        if (idx > -1) {
          updated[idx].lastMessage = adminMessage;
          updated[idx].time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          updated[idx].timestamp = Math.floor(Date.now() / 1000);
          updated[idx].agent = agentName;
          const chat = updated.splice(idx, 1)[0];
          updated.unshift(chat);
        }
        return updated;
      });
    }

    setAdminMessage("");
    setReplyingTo(null);
    setIsEmojiOpen(false);
    setIsQuickRepliesOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isInterfering) return;
    const file = e.target.files?.[0];
    if (!file || !activeAdminChat) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      const tempMsg: MessageType = {
        id: Date.now().toString(),
        body: base64,
        mimetype: file.type,
        filename: file.name,
        type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'document',
        fromMe: true,
        timestamp: Math.floor(Date.now() / 1000),
        ack: 1,
        sender: 'agent',
        hasMedia: true,
        mediaLoaded: true
      };
      setChatMessages(prev => [...prev, tempMsg]);
      if (messagesCache.current[activeAdminChat.id]) {
        messagesCache.current[activeAdminChat.id].push(tempMsg);
        saveToLocalStorage(activeAdminChat.id, activeAdminChat.connectionId, messagesCache.current[activeAdminChat.id]);
      }
      socket.emit("send_message", {
        to: activeAdminChat.id,
        file: base64,
        mimetype: file.type,
        filename: file.name,
        text: ""
      });
      toast.success("Arquivo enviado!");
      setIsAttachmentOpen(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSendPoll = () => {
    if (!activeAdminChat || !canSend) return;
    const validOptions = pollForm.options.filter(o => o.trim() !== '');
    if (!pollForm.question.trim() || validOptions.length < 2) {
      toast.error('Preencha a pergunta e no mínimo 2 opções.');
      return;
    }
    const pollData = { question: pollForm.question, options: validOptions, allowMultipleAnswers: pollForm.allowMultipleAnswers };
    const tempMsg: MessageType = {
      id: Date.now().toString(),
      type: 'poll',
      poll: pollData,
      sender: 'agent',
      fromMe: true,
      timestamp: Math.floor(Date.now() / 1000),
      ack: 1
    };
    setChatMessages(prev => [...prev, tempMsg]);
    if (messagesCache.current[activeAdminChat.id]) {
      messagesCache.current[activeAdminChat.id].push(tempMsg);
      saveToLocalStorage(activeAdminChat.id, activeAdminChat.connectionId, messagesCache.current[activeAdminChat.id]);
    }
    socket.emit("send_message", { to: activeAdminChat.id, type: 'poll', poll: pollData });
    setIsPollModalOpen(false);
    setPollForm({ question: '', options: ['', ''], allowMultipleAnswers: true });
    toast.success("Enquete enviada!");
  };

  const handleSendEvent = () => {
    if (!activeAdminChat || !canSend) return;
    if (!eventForm.name.trim() || !eventForm.date) {
      toast.error('Preencha o nome e a data do evento.');
      return;
    }
    const tempMsg: MessageType = {
      id: Date.now().toString(),
      type: 'event',
      event: eventForm,
      sender: 'agent',
      fromMe: true,
      timestamp: Math.floor(Date.now() / 1000),
      ack: 1
    };
    setChatMessages(prev => [...prev, tempMsg]);
    if (messagesCache.current[activeAdminChat.id]) {
      messagesCache.current[activeAdminChat.id].push(tempMsg);
      saveToLocalStorage(activeAdminChat.id, activeAdminChat.connectionId, messagesCache.current[activeAdminChat.id]);
    }
    socket.emit("send_message", { to: activeAdminChat.id, type: 'event', event: eventForm });
    setIsEventModalOpen(false);
    setEventForm({ name: '', description: '', date: '' });
    toast.success("Evento criado e enviado!");
  };

  const handleSendContact = (contact: { name: string; number: string }) => {
    if (!activeAdminChat || !canSend) return;
    const tempMsg: MessageType = {
      id: Date.now().toString(),
      type: 'contact',
      contact: contact,
      sender: 'agent',
      fromMe: true,
      timestamp: Math.floor(Date.now() / 1000),
      ack: 1
    };
    setChatMessages(prev => [...prev, tempMsg]);
    if (messagesCache.current[activeAdminChat.id]) {
      messagesCache.current[activeAdminChat.id].push(tempMsg);
      saveToLocalStorage(activeAdminChat.id, activeAdminChat.connectionId, messagesCache.current[activeAdminChat.id]);
    }
    socket.emit("send_message", { to: activeAdminChat.id, type: 'contact', contact: contact });
    setIsContactModalOpen(false);
    toast.success("Contato enviado!");
  };

  const openLocationModalAndFetchGPS = () => {
    setIsLocationModalOpen(true);
    setInitialMapHtml(getLeafletMapHtml(locationData.lat, locationData.lng, true));
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const data = await res.json();
            setLocationData({ lat: latitude, lng: longitude, address: data.display_name });
          } catch (e) {
            setLocationData({ lat: latitude, lng: longitude, address: "Localização Atual" });
          }
          if (mapIframeRef.current?.contentWindow) {
            mapIframeRef.current.contentWindow.postMessage({ type: 'NEW_POS', lat: latitude, lng: longitude }, '*');
          }
        },
        (error) => {
          console.error(error);
          toast.info("Não conseguimos acessar seu GPS automaticamente.");
        }
      );
    }
  };

  const handleSearchLocationApi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locSearchQuery.trim()) return;
    setIsLocSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locSearchQuery)}&limit=5`);
      const data = await res.json();
      setLocSearchResults(data);
    } catch (e) {
      toast.error("Erro na busca");
    }
    setIsLocSearching(false);
  };

  const selectSearchResult = (item: any) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    setLocationData({ lat, lng, address: item.display_name });
    if (mapIframeRef.current?.contentWindow) {
      mapIframeRef.current.contentWindow.postMessage({ type: 'NEW_POS', lat, lng }, '*');
    }
    setLocSearchResults([]);
    setLocSearchQuery('');
  };

  const handleSendLocation = () => {
    if (!activeAdminChat || !canSend) return;
    const tempMsg: MessageType = {
      id: Date.now().toString(),
      type: 'location',
      location: locationData,
      sender: 'agent',
      fromMe: true,
      timestamp: Math.floor(Date.now() / 1000),
      ack: 1
    };
    setChatMessages(prev => [...prev, tempMsg]);
    if (messagesCache.current[activeAdminChat.id]) {
      messagesCache.current[activeAdminChat.id].push(tempMsg);
      saveToLocalStorage(activeAdminChat.id, activeAdminChat.connectionId, messagesCache.current[activeAdminChat.id]);
    }
    socket.emit("send_message", { to: activeAdminChat.id, type: 'location', location: locationData });
    setIsLocationModalOpen(false);
    toast.success("Localização enviada!");
  };

  const handleLoadMore = () => {
    if (!activeAdminChat || chatMessages.length === 0) return;
    const oldestMsg = chatMessages[0];
    if (!oldestMsg?.timestamp) {
      toast.error("Não foi possível carregar mais mensagens (timestamp ausente).");
      return;
    }
    const beforeDate = new Date(oldestMsg.timestamp * 1000);
    socket.emit("get_chat_messages", {
      chatId: activeAdminChat.id,
      limit: 30,
      before: beforeDate.getTime(),
      connectionId: activeAdminChat.connectionId
    });
  };

  const startRecording = async () => {
    if (!isInterfering) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setRecordingStream(stream);
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];
      mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
      mediaRecorder.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingInterval.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
    } catch (err) { toast.error("Sem microfone."); }
  };

  const stopAndSendRecording = () => {
    if (mediaRecorder.current) {
      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          const tempMsg: MessageType = {
            id: Date.now().toString(),
            body: base64,
            mimetype: 'audio/webm',
            filename: `ptt-admin-${Date.now()}.webm`,
            type: 'ptt',
            fromMe: true,
            timestamp: Math.floor(Date.now() / 1000),
            ack: 1,
            sender: 'agent',
            hasMedia: true,
            mediaLoaded: true
          };
          setChatMessages(prev => [...prev, tempMsg]);
          if (messagesCache.current[activeAdminChat.id]) {
            messagesCache.current[activeAdminChat.id].push(tempMsg);
            saveToLocalStorage(activeAdminChat.id, activeAdminChat.connectionId, messagesCache.current[activeAdminChat.id]);
          }
          socket.emit("send_message", {
            to: activeAdminChat!.id,
            file: base64,
            mimetype: 'audio/webm',
            filename: `ptt-admin-${Date.now()}.webm`,
            isPtt: true,
            text: ""
          });
          toast.success("Áudio enviado!");
        };
        reader.readAsDataURL(audioBlob);
        recordingStream?.getTracks().forEach(track => track.stop());
        setRecordingStream(null);
      };
      mediaRecorder.current.stop();
    }
    cleanupRecording();
  };

  const cancelRecording = () => {
    if (mediaRecorder.current) { mediaRecorder.current.onstop = null; mediaRecorder.current.stop(); }
    recordingStream?.getTracks().forEach(track => track.stop());
    setRecordingStream(null);
    cleanupRecording();
  };

  const cleanupRecording = () => {
    setIsRecording(false);
    if (recordingInterval.current) clearInterval(recordingInterval.current);
    setRecordingTime(0);
    audioChunks.current = [];
  };

  const formatAudioTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const applyFormatting = (prefix: string, suffix: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const newText = adminMessage.substring(0, start) + prefix + adminMessage.substring(start, end) + suffix + adminMessage.substring(end);
    setAdminMessage(newText);
    setTimeout(() => { textareaRef.current?.focus(); textareaRef.current?.setSelectionRange(start + prefix.length, end + prefix.length); }, 10);
  };

  const getProfilePic = (c: any) => {
    const pic = c?.picUrl || c?.profilePicUrl || c?.profilePic;
    if (pic && typeof pic === 'string' && pic.trim() !== '' && !pic.includes('error') && pic.length > 10) {
      return pic;
    }
    return null;
  };

  const getMessageSender = (m: any) => {
    if (m.sender === 'system_note') return 'system_note';
    if (m.fromMe || m.sender === 'agent') return 'agent';
    return 'client';
  };

  const renderMessageStatus = (ack: number) => {
    if (ack === 3 || ack === 4) return <div className="text-[#53bdeb]"><Check size={16} className="absolute ml-[5px]" /><Check size={16} /></div>;
    if (ack === 2) return <div className="text-slate-400 dark:text-[#8696a0]"><Check size={16} className="absolute ml-[5px]" /><Check size={16} /></div>;
    if (ack === 1) return <div className="text-slate-400 dark:text-[#8696a0]"><Check size={16} /></div>;
    return <div className="text-slate-400 dark:text-[#8696a0]"><Clock size={14} /></div>;
  };

  const formatWhatsAppText = (text: string) => {
    if (!text) return "";
    let formatted = text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/`{3}([\s\S]*?)`{3}/g, '<pre class="bg-black/10 dark:bg-white/10 p-2 rounded my-1 text-[13px] font-mono whitespace-pre-wrap overflow-x-auto border border-black/10 dark:border-white/10">$1</pre>')
      .replace(/`([^`\n]+)`/g, '<code class="bg-black/10 dark:bg-white/10 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded text-[13px] font-mono border border-black/5 dark:border-white/5">$1</code>')
      .replace(/\*([^\*\n]+)\*/g, '<strong>$1</strong>')
      .replace(/_([^\_\n]+)_/g, '<em>$1</em>')
      .replace(/~([^~\n]+)~/g, '<del>$1</del>')
      .replace(/^&gt; (.*$)/gm, '<blockquote class="border-l-4 border-current opacity-80 pl-2.5 ml-1 my-1.5 py-0.5 italic bg-black/5 dark:bg-white/5 rounded-r-md">$1</blockquote>');
    return formatted;
  };

  const getMediaSrc = (m: MessageType): string | null => {
    if (m.body && typeof m.body === 'string') {
      if (m.body.startsWith('data:')) return m.body;
      if (m.body.length > 0) {
        const mime = m.mimetype || 'application/octet-stream';
        return `data:${mime};base64,${m.body}`;
      }
    }
    return m.url || null;
  };

  const renderMessageContent = (m: MessageType) => {
    const isImage = m.type === 'image' || m.mimetype?.startsWith('image/');
    const isVideo = m.type === 'video' || m.mimetype?.startsWith('video/');
    const isAudio = m.type === 'ptt' || m.type === 'audio' || m.mimetype?.startsWith('audio/');
    const isDoc = m.type === 'document' || m.mimetype?.startsWith('application/');
    const isLocation = m.type === 'location' || !!m.location;
    const isPoll = m.type === 'poll' || !!m.poll;
    const isEvent = m.type === 'event' || !!m.event;
    const isContact = m.type === 'contact' || !!m.contact;
    const isVCard = m.type === 'vcard' || !!m.vcard;
    const isSticker = m.isSticker;
    const src = getMediaSrc(m);

    if (m.hasMedia && !m.mediaLoaded && !src && activeAdminChat) {
      if (!m.mediaLoading) {
        m.mediaLoading = true;
        fetchMedia(m.id!, activeAdminChat.id, activeAdminChat.connectionId)
          .then((mediaData: any) => {
            updateMessageWithMedia(activeAdminChat.id, m.id!, mediaData);
          })
          .catch(err => {
            console.error("Erro ao carregar mídia", err);
            updateMessageWithMedia(activeAdminChat.id, m.id!, { media: null, mimetype: m.mimetype, filename: m.filename });
          });
      }
      if (isImage) {
        return (
          <div className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 h-[150px] w-[200px] rounded-lg text-slate-400 dark:text-slate-500 flex-col gap-2 border border-slate-200 dark:border-slate-700">
            <Loader2 className="animate-spin" size={24} />
            <span className="text-[10px] uppercase font-bold opacity-70">Carregando...</span>
          </div>
        );
      }
      if (isVideo) {
        return (
          <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 w-[220px]">
            <Loader2 className="animate-spin" size={20}/>
            <span className="text-xs font-medium">Carregando vídeo...</span>
          </div>
        );
      }
      if (isAudio) {
        return (
          <div className="flex items-center gap-2 min-w-[240px] mt-1 mb-1 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-full border border-slate-100 dark:border-slate-700">
            <div className={cn("p-2.5 rounded-full text-white shrink-0 flex items-center justify-center", m.fromMe ? "bg-emerald-500" : "bg-slate-500 dark:bg-slate-600")}>
              <Mic size={18}/>
            </div>
            <div className="flex-1 px-1">
              <Loader2 className="animate-spin" size={16} />
            </div>
          </div>
        );
      }
      if (isDoc) {
        return (
          <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="bg-white dark:bg-slate-900 p-2 rounded text-rose-500 shadow-sm"><FileText size={24}/></div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold truncate text-slate-700 dark:text-slate-200">{m.filename || "Carregando..."}</p>
              <Loader2 className="animate-spin" size={14} />
            </div>
          </div>
        );
      }
    }

    if (isVCard) {
      return (
        <div className="mb-1 min-w-[200px]">
          <div className="flex items-center gap-3 mb-3 border-b border-black/5 dark:border-white/5 pb-3">
            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400">
              <User size={20} />
            </div>
            <div>
              <div className="font-bold text-[15px]">Contato (VCARD)</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{m.vcard ? "VCARD anexado" : m.contact?.name || "Contato"}</div>
            </div>
          </div>
          <div className="text-emerald-600 dark:text-[#00a884] font-bold text-sm text-center cursor-pointer hover:underline">Mensagem</div>
        </div>
      );
    }

    if (isSticker) {
      const src = getMediaSrc(m);
      return (
        <div className="mb-1 -m-2 bg-transparent border-none shadow-none">
          {src ? (
            <img src={src} alt="Sticker" className="w-[140px] h-[140px] object-contain drop-shadow-md" />
          ) : (
            <div className="w-[120px] h-[120px] flex items-center justify-center text-slate-400"><ImageIcon size={40} className="opacity-50" /></div>
          )}
        </div>
      );
    }
    if (isPoll && m.poll) {
      return (
        <div className="mb-1 min-w-[240px]">
          <div className="font-bold text-lg mb-3 flex items-start gap-2"><BarChart2 className="shrink-0 mt-1" size={18} /> {m.poll.question}</div>
          <div className="flex flex-col gap-2 mb-2">
            {m.poll.options.map((opt, i) => (
              <div key={i} className="bg-black/5 dark:bg-white/5 p-2 rounded-lg text-sm border border-black/5 dark:border-white/5 flex items-center gap-3">
                <div className={cn("w-4 h-4 border border-slate-400 dark:border-slate-500 shrink-0", m.poll!.allowMultipleAnswers ? "rounded" : "rounded-full")}></div>
                <span>{opt}</span>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 text-center uppercase tracking-wide border-t border-black/5 dark:border-white/5 pt-2 mt-2">
            {m.poll.allowMultipleAnswers ? "Selecione uma ou mais opções" : "Selecione apenas uma opção"}
          </div>
        </div>
      );
    }
    if (isEvent && m.event) {
      return (
        <div className="mb-1 min-w-[240px] border border-black/5 dark:border-white/5 rounded-lg overflow-hidden bg-black/5 dark:bg-white/5">
          <div className="bg-emerald-500 dark:bg-[#00a884] p-4 text-white flex flex-col items-center justify-center">
            <Calendar size={32} className="mb-2" />
            <div className="font-bold text-center leading-tight">{m.event.name}</div>
          </div>
          <div className="p-3">
            <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{new Date(m.event.date).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">{m.event.description}</div>
            <div className="text-emerald-600 dark:text-[#00a884] font-bold text-sm text-center border-t border-black/5 dark:border-white/5 pt-2 cursor-pointer hover:underline">Ver Evento</div>
          </div>
        </div>
      );
    }
    if (isContact && m.contact) {
      return (
        <div className="mb-1 min-w-[200px]">
          <div className="flex items-center gap-3 mb-3 border-b border-black/5 dark:border-white/5 pb-3">
            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400">
              <User size={20} />
            </div>
            <div>
              <div className="font-bold text-[15px]">{m.contact.name}</div>
            </div>
          </div>
          <div className="text-emerald-600 dark:text-[#00a884] font-bold text-sm text-center cursor-pointer hover:underline">Mensagem</div>
        </div>
      );
    }
    if (isLocation) {
      const lat = m.location?.lat || -23.550520;
      const lng = m.location?.lng || -46.633308;
      return (
        <div className="mb-1 min-w-[250px] rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 cursor-pointer hover:opacity-90 transition group">
          <div className="relative h-[120px] bg-slate-200 dark:bg-slate-700">
            <iframe
              title="map"
              srcDoc={getLeafletMapHtml(lat, lng, false)}
              className="border-none w-full h-full pointer-events-none"
            ></iframe>
          </div>
          <div className="p-3 flex items-start gap-3 bg-white dark:bg-[#202c33]">
            <div>
              <div className="font-bold text-[15px] leading-tight text-slate-800 dark:text-slate-200">{m.location?.address || "Localização"}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Localização anexada</div>
            </div>
          </div>
        </div>
      );
    }
    if (isImage) {
      return (
        <div className="mb-1 relative group">
          {src ? (
            <img src={src} alt="Foto" className="rounded-lg max-w-full h-auto object-cover max-h-[300px] cursor-pointer hover:opacity-95" onClick={() => { const w = window.open(""); w?.document.write(`<img src="${src}"/>`) }} />
          ) : (
            <div className="flex items-center justify-center bg-slate-100 dark:bg-slate-800 h-[150px] w-[200px] rounded-lg text-slate-400 dark:text-slate-500 flex-col gap-2 border border-slate-200 dark:border-slate-700">
              <ImageIcon size={32} className="opacity-50" /> <span className="text-[10px] uppercase font-bold opacity-70">Foto (Histórico)</span>
            </div>
          )}
          {m.caption && <div className="mt-1 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatWhatsAppText(m.caption) }} />}
        </div>
      );
    }
    if (isVideo) {
      return (
        <div className="mb-1">
          {src ? (
            <video src={src} controls className="rounded-lg max-w-full max-h-[300px]" />
          ) : (
            <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 w-[220px]">
              <Camera size={20} /> <span className="text-xs font-medium">Vídeo (Histórico)</span>
            </div>
          )}
          {m.caption && <div className="mt-1 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatWhatsAppText(m.caption) }} />}
        </div>
      );
    }
    if (isAudio) {
      return (
        <div className="flex items-center gap-2 min-w-[200px] mt-1 mb-1 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-full border border-slate-100 dark:border-slate-700">
          <div className={cn("p-2.5 rounded-full text-white shrink-0", m.fromMe ? "bg-emerald-500" : "bg-slate-500 dark:bg-slate-600")}><Mic size={18} /></div>
          <div className="flex-1 px-1">
            {src ? <audio src={src} controls controlsList="nodownload" className="h-8 w-full max-w-[200px] dark:invert dark:hue-rotate-180" /> : <div className="text-xs text-slate-400 dark:text-slate-500 italic pl-1">Áudio não carregado</div>}
          </div>
        </div>
      );
    }
    if (isDoc) {
      return (
        <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-3 rounded-lg mt-1 mb-1 border border-slate-200 dark:border-slate-700 group relative">
          <div className="bg-white dark:bg-slate-900 p-2 rounded text-rose-500 shadow-sm"><FileText size={24} /></div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-bold truncate text-slate-700 dark:text-slate-200">{m.filename || "Arquivo"}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">{m.mimetype?.split('/')[1] || 'DOC'}</p>
          </div>
          {src && (
            <a href={src} download={m.filename || 'download'} className="p-2 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition">
              <Download size={20} />
            </a>
          )}
        </div>
      );
    }
    const rawText = m.body || m.text || "";
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = rawText.match(urlRegex);
    return (
      <div className="flex flex-col">
        <div className="text-[15px] leading-relaxed break-words whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatWhatsAppText(rawText) }} />
        {urls && urls.map((url, i) => (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="mt-2 flex flex-col bg-black/5 dark:bg-white/5 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 transition group min-w-[240px]">
            <div className="bg-slate-200 dark:bg-slate-700 h-28 flex items-center justify-center relative overflow-hidden">
              <LinkIcon className="text-slate-400 absolute opacity-50 scale-150" size={48} />
            </div>
            <div className="p-2.5">
              <div className="font-bold text-[13px] text-slate-800 dark:text-slate-200 truncate group-hover:underline">Acessar Link Externo</div>
              <div className="text-[12px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{url}</div>
            </div>
          </a>
        ))}
      </div>
    );
  };

  // ==========================================================================
  // FILTROS
  // ==========================================================================
  const formatLastMessageTime = (chat: ChatType) => {
    const ts = chat.timestamp;
    if (!ts) return chat.time || '...';
    const date = new Date(ts * 1000);
    const now = new Date();
    const isToday = date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return timeStr;
    } else {
      const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      return `${dateStr} ${timeStr}`;
    }
  };

  const uniqueAgents = Array.from(new Set(chats.map(c => c.agent).filter(Boolean)));

  const filteredChats = chats.filter(c => {
    const searchLower = search.toLowerCase();
    const matchSearch =
      c.name.toLowerCase().includes(searchLower) ||
      c.id.includes(searchLower) ||
      (c.number && c.number.includes(searchLower)) ||
      (c.lastMessage && c.lastMessage.toLowerCase().includes(searchLower));
    const matchDate = filterDate ? (() => {
      let d: Date | null = null;
      if (c.timestamp) d = new Date(c.timestamp > 1e11 ? c.timestamp : c.timestamp * 1000);
      else if (c.time) { const p = new Date(c.time); if (!isNaN(p.getTime())) d = p; }
      if (d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}` === filterDate;
      }
      return false;
    })() : true;
    const matchAgent = filterAgent ? (c.agent === filterAgent) : true;
    const matchConn = filterConnection ? (c.connectionName === filterConnection) : true;
    return matchSearch && matchDate && matchAgent && matchConn && !c.isGroup;
  });

  const displayedMessages = chatMessages.filter(m => {
    if (!messageSearch.trim()) return true;
    const text = (m.body || m.text || m.caption || '').toLowerCase();
    return text.includes(messageSearch.toLowerCase());
  });

  // ==========================================================================
  // RENDER
  // ==========================================================================
  if (activeAdminChat) {
    const cleanActiveId = activeAdminChat.id ? activeAdminChat.id.replace('@c.us', '').replace('@s.whatsapp.net', '') : '';
    const isActiveGroup = activeAdminChat.id?.includes('@g.us');
    const activeHasLetters = /[a-zA-Z]/i.test(activeAdminChat.name || '');
    const isActiveNameJustNumber = !activeHasLetters || activeAdminChat.name === cleanActiveId;
    const showActiveSubInfo = !isActiveGroup && !isActiveNameJustNumber;

    return (
      <AppLayout>
        {/* Modais (localização, enquete, evento, contato, reação) */}
        {isLocationModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-[#202c33] w-full max-w-lg rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200 dark:border-slate-800">
              <div className="bg-[#00a884] p-4 text-white flex justify-between items-center z-10">
                <h3 className="font-bold flex items-center gap-2"><MapPin size={20} /> Enviar Localização</h3>
                <button onClick={() => setIsLocationModalOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition"><X size={20} /></button>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-[#2a3942] border-b border-slate-200 dark:border-slate-700 relative z-20">
                <form onSubmit={handleSearchLocationApi} className="flex gap-2 relative">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input type="text" placeholder="Pesquisar local..." value={locSearchQuery} onChange={e => setLocSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#111b21] border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:border-[#00a884]" />
                  </div>
                  <button type="submit" disabled={isLocSearching} className="bg-[#00a884] hover:bg-[#018e6f] text-white px-4 rounded-lg text-sm font-bold flex items-center justify-center transition disabled:opacity-50 min-w-[80px]">
                    {isLocSearching ? <Loader2 size={16} className="animate-spin" /> : "Buscar"}
                  </button>
                </form>
                {locSearchResults.length > 0 && (
                  <div className="absolute top-full left-3 right-3 mt-1 bg-white dark:bg-[#202c33] rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto z-50">
                    {locSearchResults.map((item, idx) => (
                      <button key={idx} onClick={() => selectSearchResult(item)} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-[#2a3942] border-b border-slate-100 dark:border-slate-800/50 last:border-0 text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <MapPin size={16} className="shrink-0 mt-0.5 text-rose-500" />
                        <span>{item.display_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative h-[300px] bg-slate-200 dark:bg-slate-800 z-0">
                <iframe ref={mapIframeRef} title="interactive-map" srcDoc={initialMapHtml} className="border-none w-full h-full"></iframe>
              </div>
              <div className="p-4 border-t border-slate-200 dark:border-[#2a3942] flex flex-col gap-3 bg-white dark:bg-[#202c33] z-10">
                <div className="flex items-center gap-3">
                  <div className="bg-rose-100 dark:bg-rose-500/20 p-2 rounded-full text-rose-500 shrink-0"><Navigation size={20} /></div>
                  <div className="text-sm text-slate-700 dark:text-[#d1d7db] font-medium leading-tight line-clamp-2">{locationData.address}</div>
                </div>
                <button onClick={handleSendLocation} className="w-full bg-[#00a884] hover:bg-[#018e6f] text-white px-6 py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors mt-1 shadow-sm"><Send size={18} /> Enviar Esta Localização</button>
              </div>
            </div>
          </div>
        )}

        {isPollModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#202c33] w-full max-w-md rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="bg-[#00a884] p-4 text-white flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2"><BarChart2 size={20} /> Criar Enquete</h3>
                <button onClick={() => setIsPollModalOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition"><X size={20} /></button>
              </div>
              <div className="p-6 flex flex-col gap-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <input type="text" value={pollForm.question} onChange={e => setPollForm({ ...pollForm, question: e.target.value })} placeholder="Faça uma pergunta..." className="w-full bg-slate-100 dark:bg-[#2a3942] border-none rounded-lg p-3 text-[#111b21] dark:text-white focus:ring-2 focus:ring-[#00a884] outline-none" />
                <div className="flex flex-col gap-2">
                  {pollForm.options.map((opt, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input type="text" value={opt} onChange={e => { const n = [...pollForm.options]; n[i] = e.target.value; setPollForm({ ...pollForm, options: n }); }} placeholder={`Opção ${i + 1}`} className="flex-1 bg-slate-100 dark:bg-[#2a3942] border-none rounded-lg p-3 text-[#111b21] dark:text-white focus:ring-2 focus:ring-[#00a884] outline-none" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 border-t border-slate-200 dark:border-[#2a3942] flex justify-end">
                <button onClick={handleSendPoll} className="bg-[#00a884] hover:bg-[#018e6f] text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 transition-colors"><Send size={18} /> Enviar</button>
              </div>
            </div>
          </div>
        )}

        {isEventModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#202c33] w-full max-w-md rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="bg-[#00a884] p-4 text-white flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2"><Calendar size={20} /> Novo Evento</h3>
                <button onClick={() => setIsEventModalOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition"><X size={20} /></button>
              </div>
              <div className="p-6 flex flex-col gap-4">
                <input type="text" value={eventForm.name} onChange={e => setEventForm({ ...eventForm, name: e.target.value })} placeholder="Nome do evento" className="w-full bg-slate-100 dark:bg-[#2a3942] border-none rounded-lg p-3 text-[#111b21] dark:text-white focus:ring-2 focus:ring-[#00a884] outline-none" />
                <input type="datetime-local" value={eventForm.date} onChange={e => setEventForm({ ...eventForm, date: e.target.value })} className="w-full bg-slate-100 dark:bg-[#2a3942] border-none rounded-lg p-3 text-[#111b21] dark:text-white focus:ring-2 focus:ring-[#00a884] outline-none" />
                <textarea value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} placeholder="Descrição" className="w-full bg-slate-100 dark:bg-[#2a3942] border-none rounded-lg p-3 text-[#111b21] dark:text-white focus:ring-2 focus:ring-[#00a884] outline-none" rows={3} />
              </div>
              <div className="p-4 border-t border-slate-200 dark:border-[#2a3942] flex justify-end">
                <button onClick={handleSendEvent} className="bg-[#00a884] hover:bg-[#018e6f] text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 transition-colors"><Send size={18} /> Enviar</button>
              </div>
            </div>
          </div>
        )}

        {isContactModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#202c33] w-full max-w-md rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="bg-[#00a884] p-4 text-white flex justify-between items-center">
                <h3 className="font-bold flex items-center gap-2"><User size={20} /> Selecionar Contato</h3>
                <button onClick={() => setIsContactModalOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition"><X size={20} /></button>
              </div>
              <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="text" placeholder="Pesquisar contato..." value={contactSearch} onChange={e => setContactSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-[#202c33] border border-slate-300 dark:border-slate-700 rounded-lg text-sm outline-none" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto h-72 custom-scrollbar">
                {filteredModalContacts.map((contact, i) => (
                  <div key={i} onClick={() => handleSendContact(contact)} className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-[#202c33] cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400">
                      <User size={24} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{contact.name}</div>
                      <div className="text-sm text-slate-500 dark:text-[#8696a0]">{contact.number}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {isReactionOpen && messageForReaction && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={() => { setIsReactionOpen(false); setMessageForReaction(null); }}>
            <div className="bg-white dark:bg-[#111b21] rounded-xl p-4 w-80" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-2 text-center">Reagir</h3>
              <EmojiPicker
                onEmojiSelect={(emoji) => {
                  socket.emit('send_reaction', {
                    chatId: activeAdminChat!.id,
                    messageId: messageForReaction,
                    emoji: emoji,
                  });
                  setIsReactionOpen(false);
                  setMessageForReaction(null);
                }}
              />
              <button
                onClick={() => {
                  setIsReactionOpen(false);
                  setMessageForReaction(null);
                }}
                className="mt-2 w-full py-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col pt-0.5 transition-colors duration-200">
          <div className="flex flex-col h-[calc(100vh-80px)] bg-[#efeae2] dark:bg-[#0b141a] relative m-4 rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800">
            <div className="absolute inset-0 z-0 opacity-[0.4] dark:opacity-[0.06] dark:invert pointer-events-none" style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundSize: "initial", backgroundRepeat: "repeat" }}></div>
            <div className="h-16 bg-slate-900 dark:bg-[#202c33] border-b border-slate-800 dark:border-slate-700/50 px-6 flex items-center justify-between shadow-md z-10 relative">
              <div className="flex items-center gap-4 text-white">
                <button onClick={() => { setActiveAdminChat(null); if (isInterfering) { socket.emit("interfere_chat", { chatId: activeAdminChat.id, isBlocked: false }); } }} className="p-2 hover:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition"><X size={20} /></button>
                <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden flex items-center justify-center font-bold text-white shrink-0 border border-slate-600">
                  {getProfilePic(activeAdminChat) ? (
                    <img
                      src={getProfilePic(activeAdminChat)}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) parent.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user text-slate-300"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
                      }}
                      alt="avatar"
                    />
                  ) : <User size={20} className="text-slate-300" />}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm flex items-center gap-2">{activeAdminChat.name} <span className="bg-blue-500 dark:bg-blue-600 text-[10px] px-2 py-0.5 rounded text-white font-bold">Modo Gestão</span></div>
                  {showActiveSubInfo && (
                    <div className="text-xs text-slate-400 dark:text-slate-300">{cleanActiveId}</div>
                  )}
                </div>
                <div className="relative w-64">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar na conversa..."
                    value={messageSearch}
                    onChange={(e) => setMessageSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-800 text-white rounded-full text-sm outline-none border border-slate-700"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={toggleInterference} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm", isInterfering ? "bg-rose-500 hover:bg-rose-600 text-white animate-pulse" : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700")}>
                  <Hand size={16} /> {isInterfering ? "Soltar Teclado" : "Travar Agente"}
                </button>
                <button onClick={() => setIsNoteMode(!isNoteMode)} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm", isNoteMode ? "bg-amber-400 text-amber-900" : "bg-slate-800 dark:bg-slate-700 text-slate-300 dark:text-slate-200 hover:bg-slate-700 dark:hover:bg-slate-600")}>
                  <StickyNote size={16} /> Nota Interna
                </button>
              </div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar relative z-10">
              {!isLoadingMessages && displayedMessages.length > 0 && (
                <div className="text-center py-3">
                  <button
                    onClick={handleLoadMore}
                    className="px-6 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-sm font-medium text-slate-700 dark:text-slate-300 transition"
                  >
                    Carregar mais mensagens (mais antigas)
                  </button>
                </div>
              )}

              {isLoadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full opacity-60"><Loader2 className="animate-spin text-emerald-600 dark:text-emerald-400 mb-2" size={32} /></div>
              ) : (
                displayedMessages.map((m, idx) => {
                  const senderType = getMessageSender(m);
                  const uniqueKey = m.id ? `${m.id}_${m.timestamp}` : `msg-${idx}`;
                  return (
                    <div key={uniqueKey} className={cn("w-fit max-w-[90%] lg:max-w-[65%] p-1 rounded-lg text-[14.5px] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] relative flex flex-col group",
                      senderType === 'agent' ? "bg-[#d9fdd3] dark:bg-[#005c4b] ml-auto rounded-tr-none text-[#111b21] dark:text-[#e9edef]" :
                      senderType === 'system_note' ? "bg-[#fff3c4] dark:bg-[#4d3c00] max-w-[95%] lg:max-w-[70%] mx-auto text-amber-900 dark:text-amber-100 font-medium text-center shadow-md rounded-xl border border-amber-200 dark:border-amber-700/50 px-3 py-2" :
                      "bg-white dark:bg-[#202c33] mr-auto rounded-tl-none text-[#111b21] dark:text-[#e9edef]"
                    )}>
                      {senderType === 'system_note' && <div className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-300 mb-1 flex items-center justify-center gap-1"><ShieldAlert size={12} /> Nota Interna</div>}

                      {senderType !== 'system_note' && canSend && (
                        <button onClick={() => setReplyingTo(m)} className={cn("absolute top-0 w-8 h-8 flex items-center justify-center bg-black/20 dark:bg-white/20 text-white dark:text-slate-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 backdrop-blur-sm", senderType === 'agent' ? "-left-10" : "-right-10")}>
                          <Reply size={16} />
                        </button>
                      )}

                      {senderType !== 'system_note' && canSend && (
                        <button
                          onClick={() => {
                            setMessageForReaction(m.id || null);
                            setIsReactionOpen(true);
                          }}
                          className={cn(
                            "absolute top-0 w-8 h-8 flex items-center justify-center bg-black/20 dark:bg-white/20 text-white dark:text-slate-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 backdrop-blur-sm",
                            senderType === 'agent' ? "-left-20" : "-right-20"
                          )}
                        >
                          <Smile size={16} />
                        </button>
                      )}

                      {m.reaction && (
                        <div className="absolute -bottom-4 right-4 text-3xl drop-shadow-md z-10">{m.reaction}</div>
                      )}

                      <div className="px-2 pt-1 pb-4 min-w-[80px]">{renderMessageContent(m)}</div>
                      {senderType !== 'system_note' && !m.isSticker && (
                        <div className="absolute bottom-1 right-2 flex items-center gap-1">
                          <span className="text-[10px] text-[#667781] dark:text-[#8696a0]">{m.timestamp ? new Date(m.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}</span>
                          {m.fromMe && <span className="text-[#53bdeb] ml-0.5">{renderMessageStatus(m.ack || 0)}</span>}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div className="bg-[#f0f2f5] dark:bg-[#202c33] px-4 py-2 flex flex-col gap-2 relative z-20 border-t border-slate-200 dark:border-slate-800/50">
              {isEmojiOpen && <div className="absolute bottom-[65px] left-4 z-50 w-[360px] h-[450px]"><EmojiPicker onEmojiSelect={(emoji) => setAdminMessage(p => p + emoji)} /></div>}
              {isQuickRepliesOpen && <QuickReplies onSelect={(text) => { setAdminMessage(p => p + text); setIsQuickRepliesOpen(false); }} />}
              {isAttachmentOpen && (
                <div className="absolute bottom-[80px] left-4 bg-white dark:bg-[#111b21] rounded-2xl shadow-2xl w-[280px] z-50 border border-slate-200 dark:border-slate-800 p-4 overflow-hidden attachment-container">
                  <div className="grid grid-cols-4 gap-6 text-center">
                    <button
                      onClick={() => { imageInputRef.current?.click(); setIsAttachmentOpen(false); }}
                      className="flex flex-col items-center gap-2 hover:bg-slate-100 dark:hover:bg-[#202c33] p-2 rounded-xl transition"
                    >
                      <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center"><ImageIcon size={28} className="text-emerald-600" /></div>
                      <span className="text-xs text-slate-700 dark:text-slate-300">Galeria</span>
                    </button>
                    <button
                      onClick={() => { fileInputRef.current?.click(); setIsAttachmentOpen(false); }}
                      className="flex flex-col items-center gap-2 hover:bg-slate-100 dark:hover:bg-[#202c33] p-2 rounded-xl transition"
                    >
                      <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center"><FileText size={28} className="text-emerald-600" /></div>
                      <span className="text-xs text-slate-700 dark:text-slate-300">Documento</span>
                    </button>
                    <button
                      onClick={() => { audioInputRef.current?.click(); setIsAttachmentOpen(false); }}
                      className="flex flex-col items-center gap-2 hover:bg-slate-100 dark:hover:bg-[#202c33] p-2 rounded-xl transition"
                    >
                      <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center"><Mic size={28} className="text-emerald-600" /></div>
                      <span className="text-xs text-slate-700 dark:text-slate-300">Áudio</span>
                    </button>
                    <button
                      onClick={() => { openLocationModalAndFetchGPS(); setIsAttachmentOpen(false); }}
                      className="flex flex-col items-center gap-2 hover:bg-slate-100 dark:hover:bg-[#202c33] p-2 rounded-xl transition"
                    >
                      <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center"><MapPin size={28} className="text-emerald-600" /></div>
                      <span className="text-xs text-slate-700 dark:text-slate-300">Localização</span>
                    </button>
                  </div>
                </div>
              )}
              {replyingTo && (
                <div className="flex items-center justify-between bg-white dark:bg-[#2a3942] p-2 rounded-lg border-l-4 border-[#00a884] shadow-sm">
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-xs font-bold text-[#00a884]">Respondendo a {replyingTo.fromMe ? 'Agente' : activeAdminChat.name}</span>
                    <span className="text-xs text-slate-500 dark:text-[#8696a0] truncate">{replyingTo.body || replyingTo.caption || "Mídia"}</span>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="p-1"><X size={16} /></button>
                </div>
              )}
              {isRecording ? (
                <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-lg flex items-center px-4 h-[44px] shadow-sm justify-between">
                  <button onClick={cancelRecording} className="text-rose-500"><Trash2 size={20} /></button>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-slate-700 dark:text-slate-200 font-mono text-sm">{formatAudioTime(recordingTime)}</span>
                    <AudioVisualizer stream={recordingStream} />
                  </div>
                  <button onClick={stopAndSendRecording} className="bg-emerald-500 text-white p-2 rounded-full"><Send size={18} /></button>
                </div>
              ) : (
                <div className="flex items-end gap-3">
                  <div className="mb-1 flex gap-1">
                    <button disabled={!canSend} onClick={() => setIsAttachmentOpen(!isAttachmentOpen)} className="p-2 text-[#54656f] dark:text-[#aebac1]"><Plus size={26} /></button>
                    <button disabled={!canSend} onClick={() => setIsQuickRepliesOpen(!isQuickRepliesOpen)} className="p-2 text-[#54656f] dark:text-[#aebac1]"><Zap size={24} /></button>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                  <input type="file" ref={imageInputRef} className="hidden" onChange={handleFileUpload} />
                  <input type="file" ref={audioInputRef} className="hidden" onChange={handleFileUpload} />
                  <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-xl shadow-sm border border-transparent focus-within:border-emerald-500/30 flex flex-col relative overflow-hidden">
                    <div className="flex items-end px-2 py-1 min-h-[44px]">
                      <button disabled={!canSend} onClick={() => setIsEmojiOpen(!isEmojiOpen)} className="p-2 text-[#54656f] dark:text-[#aebac1]"><Smile size={24} /></button>
                      <textarea ref={textareaRef} disabled={!canSend} value={adminMessage} onChange={e => setAdminMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendAdminMessage())} placeholder={!canSend ? "Trave o agente para digitar..." : "Mensagem..."} rows={1} className="flex-1 bg-transparent px-2 py-[10px] outline-none text-[15px] text-[#111b21] dark:text-white resize-none" style={{ maxHeight: '120px' }} />
                    </div>
                  </div>
                  <div className="mb-1">
                    {adminMessage.trim() ? (
                      <button disabled={!canSend} onClick={handleSendAdminMessage} className="p-2 text-[#54656f] dark:text-[#aebac1] hover:text-emerald-600"><Send size={24} /></button>
                    ) : (
                      <button disabled={!canSend} onClick={startRecording} className="p-2 text-[#54656f] dark:text-[#aebac1]"><Mic size={24} /></button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
        <div className="p-4 lg:p-8 max-w-6xl mx-auto text-slate-900 dark:text-white">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold">Gestão Global</h1>
              <p className="text-slate-500 dark:text-slate-400">Supervisione e interfira em todas as conversas em tempo real.</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col gap-4">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none transition-all" />
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowFilters(!showFilters)} className="p-2 border rounded-xl flex items-center gap-2 px-4 shadow-sm text-sm font-bold bg-white dark:bg-slate-800"><Filter size={16} /> Filtros</button>
                  <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
                    <button onClick={() => setViewMode('grid')} className={cn("p-1.5 rounded-md", viewMode === 'grid' ? "bg-white dark:bg-slate-700 text-blue-600" : "text-slate-500")}><LayoutGrid size={16} /></button>
                    <button onClick={() => setViewMode('list')} className={cn("p-1.5 rounded-md", viewMode === 'list' ? "bg-white dark:bg-slate-700 text-blue-600" : "text-slate-500")}><List size={16} /></button>
                  </div>
                  <button onClick={() => { setIsLoading(true); socket.emit('get_chats', { limit: 30 }); }} className="p-2 bg-white dark:bg-slate-800 border rounded-xl flex items-center gap-2 px-4"><RefreshCw size={16} className={cn(isLoading && "animate-spin")} /><span className="text-sm font-bold">Atualizar</span></button>
                </div>
              </div>
              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Data da última mensagem</label>
                    <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Agente</label>
                    <select
                      value={filterAgent}
                      onChange={(e) => setFilterAgent(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none"
                    >
                      <option value="">Todos</option>
                      {uniqueAgents.map(agent => (
                        <option key={agent} value={agent}>{agent}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Conexão</label>
                    <select
                      value={filterConnection}
                      onChange={(e) => setFilterConnection(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none"
                    >
                      <option value="">Todas</option>
                      {availableConnections
                        .filter(conn => connectionStatuses[conn.id]?.enabled && connectionStatuses[conn.id]?.status === 'connected')
                        .map(conn => (
                          <option key={conn.id} value={conn.name}>{conn.name}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <button onClick={() => { setFilterDate(''); setFilterAgent(''); setFilterConnection(''); }} className="w-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-xl px-4 py-2 text-sm font-medium transition flex items-center justify-center gap-2">
                      <FilterX size={14} /> Limpar filtros
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className={cn("p-4 flex-1 overflow-y-auto min-h-[400px]", viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "divide-y divide-slate-100 dark:divide-slate-800 space-y-2")}>
              {filteredChats.map((chat) => (
                <div key={chat.id} className={cn("hover:bg-blue-50/30 dark:hover:bg-slate-800/50 transition-colors flex justify-between", viewMode === 'grid' ? "flex-col p-5 bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 rounded-2xl gap-4 relative" : "items-center p-4 relative")}>
                  {chat.unread > 0 && <div className="absolute top-4 right-4 bg-emerald-500 text-white w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold shadow-sm">{chat.unread}</div>}
                  <div className="flex items-start gap-4 min-w-0 w-full">
                    <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-slate-700 shadow-sm flex-shrink-0 border border-slate-200 dark:border-slate-600">
                      {getProfilePic(chat) ? (
                        <img
                          src={getProfilePic(chat)}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent) parent.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user text-slate-400"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
                          }}
                          alt="avatar"
                        />
                      ) : <User size={24} className="text-slate-400" />}
                    </div>
                    <div className="min-w-0 flex-1 pr-6">
                      <p className="font-bold truncate text-[15px] flex items-center gap-2">
                        {chat.connectionColor && (
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: chat.connectionColor }} title={chat.connectionName} />
                        )}
                        {chat.name}
                      </p>
                      <p className="text-[13px] text-slate-500 line-clamp-2 leading-tight">{chat.lastMessage || <span className="italic opacity-60">Mídia</span>}</p>
                      {chat.agent && (
                        <p className="text-[12px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">👤 Atendido por: {chat.agent}</p>
                      )}
                    </div>
                  </div>
                  <div className={cn("flex items-center gap-3", viewMode === 'grid' ? "w-full justify-between mt-auto pt-4 border-t border-slate-100 dark:border-slate-700/50" : "flex-shrink-0")}>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Clock size={12} /><span className="text-[11px] font-bold">{formatLastMessageTime(chat)}</span>
                    </div>
                    <button onClick={() => setActiveAdminChat(chat)} className="px-4 py-2 bg-slate-900 dark:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-2"><Eye size={14} /> Espiar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Management;