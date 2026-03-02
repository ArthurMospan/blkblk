// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { Eye, X, Equal, Plus, CheckCircle2, AlertCircle, Copy, Check, Volume2 } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';

// ТВОЇ КЛЮЧІ FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyDocwvJ_qKVX4VImnf6auhVdzZj_9sfPoo",
  authDomain: "mospan-game.firebaseapp.com",
  projectId: "mospan-game",
  storageBucket: "mospan-game.firebasestorage.app",
  messagingSenderId: "802493665785",
  appId: "1:802493665785:web:1d8f076910fbb000cb2d28"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const gameAppId = 'blk-blk-v2';

// --- СИСТЕМА ЗВУКІВ ---
const playSound = (type) => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;

  switch (type) {
    case 'click':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    case 'play':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
      break;
    case 'success':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(1000, now + 0.3);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
    case 'error':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.4);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
      break;
  }
};

const CLAIM_PHRASES = [
  "{name}: Тут {countWord} по «{value}»", 
  "{name} отвічає, шо тут {countWord} по «{value}»", 
  "Зуб даю, тут {countWord} по «{value}» ({name})", 
  "Бля буду, тут {countWord} по «{value}»",
  "{name} мамой клянеться: {countWord} по «{value}»", 
  "Залізобетонно тут {countWord} по «{value}»", 
  "Інфа сотка: {countWord} по «{value}»",
  "Сто пудів тут {countWord} по «{value}» ({name})", 
  "Не парся, тут точно {countWord} по «{value}»", 
  "{name} стелить: {countWord} по «{value}»"
];

const countToWord = (n) => {
  const map = { 1: 'одна', 2: 'дві', 3: 'три', 4: 'чотири' };
  return map[n] || n;
};

const CARD_TYPES = { STANDARD: 'standard', MARKED: 'X', CHAMELEON: 'chameleon', DISCARD: '=', EYE: 'eye' };

// Утилітарна функція перевірки перемоги
const checkWin = (hands) => Object.keys(hands).find(uid => hands[uid] && hands[uid].length === 0) || null;

const createDeck = () => {
  let deck = [];
  for (let val = 1; val <= 10; val++) {
    for (let i = 0; i < 4; i++) { deck.push({ id: `s_${val}_${i}`, type: CARD_TYPES.STANDARD, value: val }); }
  }
  deck.push({ id: 'm_1', type: CARD_TYPES.MARKED, value: null });
  deck.push({ id: 'm_2', type: CARD_TYPES.MARKED, value: null });
  deck.push({ id: 'c_1', type: CARD_TYPES.CHAMELEON, value: null });
  deck.push({ id: 'c_2', type: CARD_TYPES.CHAMELEON, value: null });
  deck.push({ id: 'd_1', type: CARD_TYPES.DISCARD, value: null });
  deck.push({ id: 'd_2', type: CARD_TYPES.DISCARD, value: null });
  deck.push({ id: 'e_1', type: CARD_TYPES.EYE, value: null });
  deck.push({ id: 'e_2', type: CARD_TYPES.EYE, value: null });
  
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

const CardBack = () => (
  <div className="w-full h-full bg-[#111] rounded-[12%] border-[1px] border-white/10 flex items-center justify-center shadow-lg relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
    <div className="flex flex-col items-start transform -skew-x-[15deg] scale-[0.5]">
      <span className="text-white font-black text-xl leading-[0.8] tracking-tighter italic font-sans">BLK</span>
      <span className="text-white font-black text-xl leading-[0.8] tracking-tighter italic font-sans">BLK</span>
    </div>
  </div>
);

const CardFace = ({ card, isSelected }) => {
  const bgClass = isSelected ? 'bg-white shadow-2xl ring-4 ring-zinc-900/10' : 'bg-[#111] shadow-xl';
  const textClass = isSelected ? 'text-black' : 'text-white';
  const borderClass = isSelected ? 'border-black/5' : 'border-white/5';

  if (card.type === CARD_TYPES.CHAMELEON) {
    return (
      <div className={`w-full h-full rounded-[12%] border-[2px] relative overflow-hidden transition-all duration-300 ${bgClass} ${borderClass}`}>
         {!isSelected && <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>}
      </div>
    );
  }

  let centerContent, cornerContentTop;
  const fontStyle = { fontFamily: "'Space Grotesk', 'Outfit', sans-serif" };

  if (card.type === CARD_TYPES.STANDARD) {
    const is6or9 = card.value === 6 || card.value === 9;
    const underlineColor = isSelected ? 'bg-black' : 'bg-white';
    centerContent = (
      <div className="flex flex-col items-center justify-center h-full">
        <span className="text-5xl font-light tracking-tighter" style={fontStyle}>{card.value}</span>
        {is6or9 && <div className={`w-8 h-[2.5px] mt-0.5 ${underlineColor}`}></div>}
      </div>
    );
    cornerContentTop = (
      <div className="absolute top-2 left-2.5 flex flex-col items-center">
        <span className="font-light text-base leading-none" style={fontStyle}>{card.value}</span>
        {is6or9 && <div className={`w-3 h-[1px] mt-[1px] ${underlineColor}`}></div>}
      </div>
    );
  } else {
    const Icon = card.type === CARD_TYPES.MARKED ? X : card.type === CARD_TYPES.DISCARD ? Equal : Eye;
    centerContent = <Icon size={44} strokeWidth={1} />;
    cornerContentTop = <div className="absolute top-2 left-2.5"><Icon size={14} strokeWidth={2.5} /></div>;
  }

  return (
    <div className={`w-full h-full rounded-[12%] border-[1px] ${bgClass} ${textClass} ${borderClass} flex flex-col items-center justify-center relative transition-all duration-300 overflow-hidden`}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;700&display=swap');`}</style>
      {cornerContentTop}{centerContent}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [error, setError] = useState('');
  const [selectedCards, setSelectedCards] = useState([]);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [lastPileSize, setLastPileSize] = useState(0);
  const [pileAnimation, setPileAnimation] = useState('');
  const [toast, setToast] = useState({ text: '', type: 'info', visible: false, id: 0 });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (err) { console.error("Auth error:", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !roomId) return;
    const currentRoomRef = doc(db, 'artifacts', gameAppId, 'public', 'data', 'rooms', roomId);
    const unsubscribe = onSnapshot(currentRoomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRoomData(data);
        const currentPileSize = data.pile.reduce((acc, p) => acc + p.cards.length, 0);
        if (currentPileSize > lastPileSize) {
          setPileAnimation('animate-drop');
          setTimeout(() => setPileAnimation(''), 300);
        }
        setLastPileSize(currentPileSize);
        if (data.lastEvent && data.lastEvent.ts !== toast.id) {
          setToast({ text: String(data.lastEvent.text), type: data.lastEvent.type || 'info', visible: true, id: data.lastEvent.ts });
          if (data.lastEvent.type === 'success') playSound('success');
          if (data.lastEvent.type === 'error') playSound('error');
        }
      } else {
        setError("Кімнату закрито."); setRoomId(''); setRoomData(null);
      }
    }, (err) => console.error("Sync err:", err));
    return () => unsubscribe();
  }, [user, roomId, lastPileSize, toast.id]);

  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.visible, toast.id]);

  const copyRoomId = () => {
    if (!roomData) return;
    const el = document.createElement('textarea');
    el.value = roomData.id;
    document.body.appendChild(el);
    el.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      playSound('click');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) { console.error('Copy failed', err); }
    document.body.removeChild(el);
  };

  const createRoom = async () => {
    if (!userName.trim()) { setError("Введіть ім'я"); return; }
    const code = generateRoomCode();
    await setDoc(doc(db, 'artifacts', gameAppId, 'public', 'data', 'rooms', code), {
      id: code, hostId: user.uid, status: 'lobby',
      players: [{ id: user.uid, name: userName, isBot: false }],
      playerHands: {}, turnIndex: 0, phase: 'NEW_ROUND', pile: [],
      discardPileCount: 0, currentClaim: null, winnerId: null,
      revealedCardsTo: null, revealedCards: null, lastEvent: null, claimPhraseIndex: 0
    });
    setRoomId(code); setError('');
    playSound('click');
  };

  const joinRoom = async () => {
    if (!userName.trim() || !joinCode.trim()) { setError("Введіть дані"); return; }
    const code = joinCode.toUpperCase();
    const joinRoomRef = doc(db, 'artifacts', gameAppId, 'public', 'data', 'rooms', code);
    const snap = await getDoc(joinRoomRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.status !== 'lobby') { setError("Гра йде"); return; }
      if (!data.players.find(p => p.id === user.uid)) {
        await updateDoc(joinRoomRef, { players: [...data.players, { id: user.uid, name: userName, isBot: false }] });
      }
      setRoomId(code); setError('');
      playSound('click');
    } else { setError("Кімнату не знайдено"); playSound('error'); }
  };

  const addBot = async () => {
    const currentRoomRef = doc(db, 'artifacts', gameAppId, 'public', 'data', 'rooms', roomId);
    const botNum = roomData.players.filter(p => p.isBot).length + 1;
    await updateDoc(currentRoomRef, { players: [...roomData.players, { id: `bot_${Date.now()}`, name: `БОТ ${botNum}`, isBot: true }] });
    playSound('click');
  };

  const startGame = async () => {
    const deck = createDeck();
    const numPlayers = roomData.players.length;
    const cardsPerPlayer = Math.floor(48 / numPlayers);
    const hands = {};
    roomData.players.forEach((p, index) => {
      hands[p.id] = deck.slice(index * cardsPerPlayer, (index + 1) * cardsPerPlayer);
    });
    await updateDoc(doc(db, 'artifacts', gameAppId, 'public', 'data', 'rooms', roomId), {
      status: 'playing', playerHands: hands, turnIndex: 0, phase: 'NEW_ROUND',
      pile: [], discardPileCount: 0, winnerId: null, currentClaim: null,
      revealedCardsTo: null, revealedCards: null, lastEvent: { text: 'Гру розпочато!', type: 'info', ts: Date.now() }, claimPhraseIndex: 0
    });
    playSound('success');
  };

  const submitPlayCards = async (claim, playerId = user.uid, cards = selectedCards) => {
    if (!roomId) return;
    const roomDocRef = doc(db, 'artifacts', gameAppId, 'public', 'data', 'rooms', roomId);
    const snap = await getDoc(roomDocRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const newHand = data.playerHands[playerId].filter(c => !cards.some(sc => sc.id === c.id));
    const newHands = { ...data.playerHands, [playerId]: newHand };
    const newPile = [...data.pile, { playerId, cards, claimValue: claim }];
    
    // ПРИМІТКА: Ми НЕ перевіряємо переможця тут, бо раунд ще не закінчився.
    await updateDoc(roomDocRef, {
      playerHands: newHands, pile: newPile, currentClaim: claim, phase: 'RESPOND',
      turnIndex: (data.turnIndex + 1) % data.players.length,
      revealedCardsTo: null, revealedCards: null, claimPhraseIndex: Math.floor(Math.random() * CLAIM_PHRASES.length)
    });
    if (playerId === user.uid) { setSelectedCards([]); setShowClaimModal(false); }
    playSound('play');
  };

  const submitAction = async (action, playerId = user.uid) => {
    if (!roomId) return;
    const roomDocRef = doc(db, 'artifacts', gameAppId, 'public', 'data', 'rooms', roomId);
    const snap = await getDoc(roomDocRef);
    if (!snap.exists()) return;
    const data = snap.data();
    let newHands = { ...data.playerHands };
    let newPile = [...data.pile];
    const lastPlay = newPile[newPile.length - 1];
    const isTruth = lastPlay.cards.every(c => c.value === lastPlay.claimValue || c.type === CARD_TYPES.CHAMELEON);
    const currName = data.players.find(p => p.id === playerId)?.name || 'Гравець';
    const prevName = data.players.find(p => p.id === lastPlay?.playerId)?.name || 'Попередній';
    let eventMsg = '';
    let eventType = 'info';
    let nextTurn = data.turnIndex;

    const givePileTo = (targetUid) => {
      newHands[targetUid] = [...newHands[targetUid], ...newPile.flatMap(p => p.cards)];
      newPile = [];
    };

    if (action === 'BELIEVE') {
      if (isTruth) {
        eventMsg = `✅ ${currName} вірить і вгадує! Стіл скинуто.`;
        eventType = 'success';
        newPile = [];
      } else {
        eventMsg = `❌ ${currName} помиляється (вірить у брехню)! Забирає карти.`;
        eventType = 'error';
        givePileTo(playerId);
        nextTurn = (data.turnIndex + 1) % data.players.length;
      }
    } else {
      if (!isTruth) {
        eventMsg = `✅ ${currName} впіймав брехуна! ${prevName} забирає карти.`;
        eventType = 'success';
        givePileTo(lastPlay.playerId);
      } else {
        eventMsg = `❌ ${currName} каже "БРЕХНЯ", але там була правда! Забирає карти.`;
        eventType = 'error';
        givePileTo(playerId);
        nextTurn = (data.turnIndex + 1) % data.players.length;
      }
    }

    // ТІЛЬКИ ТУТ ПЕРЕВІРЯЄМО ПЕРЕМОЖЦЯ (Коли стопку розіграно)
    const winner = checkWin(newHands);

    await updateDoc(roomDocRef, {
      playerHands: newHands, pile: newPile, turnIndex: nextTurn,
      phase: 'NEW_ROUND', currentClaim: null, winnerId: winner,
      lastEvent: { text: eventMsg, type: eventType, ts: Date.now() }
    });
    if (playerId === user.uid) setSelectedCards([]);
  };

  const submitSpecialCard = async (cardType, playerId = user.uid) => {
    if (!roomId) return;
    const roomDocRef = doc(db, 'artifacts', gameAppId, 'public', 'data', 'rooms', roomId);
    const snap = await getDoc(roomDocRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const currName = data.players.find(p => p.id === playerId)?.name || 'Гравець';
    const playedCard = data.playerHands[playerId].find(c => c.type === cardType);
    const newHand = data.playerHands[playerId].filter(c => c.id !== playedCard.id);
    const newHands = { ...data.playerHands, [playerId]: newHand };
    let updates = { playerHands: newHands };
    
    if (cardType === CARD_TYPES.DISCARD) {
      updates.pile = []; updates.phase = 'NEW_ROUND';
      updates.lastEvent = { text: `⚡ ${currName} кидає ВІДБІЙ!`, type: 'info', ts: Date.now() };
      // Оскільки раунд закінчено "Відбоєм", перевіряємо переможця
      updates.winnerId = checkWin(newHands);
    } else if (cardType === CARD_TYPES.EYE) {
      updates.revealedCardsTo = playerId;
      updates.revealedCards = data.pile[data.pile.length - 1].cards;
      updates.lastEvent = { text: `👁 ${currName} дивиться карти.`, type: 'info', ts: Date.now() };
    }
    await updateDoc(roomDocRef, updates);
    if (playerId === user.uid) setSelectedCards([]);
    playSound('play');
  };

  const toggleCard = (card) => {
    playSound('click');
    setSelectedCards(prev => {
      if (prev.some(c => c.id === card.id)) return prev.filter(c => c.id !== card.id);
      return [...prev, card];
    });
  };

  useEffect(() => {
    if (!roomData || roomData.status !== 'playing' || roomData.winnerId || roomData.hostId !== user?.uid) return;
    const currentPlayer = roomData.players[roomData.turnIndex];
    if (!currentPlayer || !currentPlayer.isBot) return;
    const timer = setTimeout(async () => {
      const roomRef = doc(db, 'artifacts', gameAppId, 'public', 'data', 'rooms', roomId);
      const snap = await getDoc(roomRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const botId = currentPlayer.id;
      const hand = data.playerHands[botId];
      if (!hand) return;

      if (data.phase === 'NEW_ROUND') {
        const toPlay = hand.slice(0, Math.min(Math.floor(Math.random() * 2) + 1, hand.length));
        let claim = Math.floor(Math.random() * 10) + 1;
        if (toPlay.length > 0 && toPlay[0].type === CARD_TYPES.STANDARD && Math.random() > 0.3) claim = toPlay[0].value;
        submitPlayCards(claim, botId, toPlay);
      } else {
        const pileSize = data.pile.reduce((acc, p) => acc + p.cards.length, 0);
        if (Math.random() > 0.65 || pileSize > 4) submitAction('DISBELIEVE', botId);
        else submitAction('BELIEVE', botId);
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [roomData?.turnIndex, roomData?.phase, roomData?.status]);

  if (!user) return <div className="h-dvh bg-stone-50 flex items-center justify-center font-black uppercase text-zinc-900 tracking-widest italic">BLK BLK...</div>;

  // --- LOBBY UI ---
  if (!roomData || roomData.status === 'lobby') {
    return (
      <div className="h-dvh w-full fixed inset-0 bg-stone-50 text-zinc-900 font-mono flex flex-col items-center justify-center p-6 overflow-hidden text-center">
        <h1 className="flex flex-col transform -skew-x-[12deg] mb-12 drop-shadow-md shrink-0">
          <span className="text-7xl font-black leading-[0.8] tracking-tighter font-sans italic">BLK</span>
          <span className="text-7xl font-black leading-[0.8] tracking-tighter font-sans italic text-zinc-400">BLK</span>
        </h1>
        {error && <div className="bg-red-50 text-red-500 p-3 mb-6 w-full max-w-sm text-xs font-bold rounded-xl text-center border border-red-100 uppercase">{error}</div>}
        {!roomData ? (
          <div className="w-full max-w-sm space-y-4 shrink-0">
            <input className="w-full bg-white border border-zinc-200 rounded-2xl p-4 text-center uppercase font-bold focus:ring-2 focus:ring-zinc-900 outline-none shadow-sm" placeholder="ТВОЄ ІМ'Я" value={userName} onChange={e => setUserName(e.target.value)} />
            <div className="space-y-4">
              <div className="flex gap-2">
                <input className="flex-1 bg-white border border-zinc-200 rounded-2xl p-4 text-center uppercase font-bold text-sm shadow-sm" placeholder="КОД КІМНАТИ" maxLength={4} value={joinCode} onChange={e => setJoinCode(e.target.value)} />
                <button onClick={joinRoom} className="px-8 bg-zinc-900 text-white rounded-2xl font-black text-xs uppercase active:scale-95 transition-all shadow-xl">УВІЙТИ</button>
              </div>
              <div className="flex justify-center pt-2">
                <button onClick={createRoom} className="text-zinc-400 font-black uppercase text-[10px] tracking-widest hover:text-zinc-900 underline underline-offset-4 active:scale-95 transition-all">або створити власну кімнату</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-sm bg-white rounded-[2.5rem] p-8 text-center space-y-6 shadow-2xl border border-zinc-100 shrink-0">
            <div onClick={copyRoomId} className="cursor-pointer group relative active:scale-95 transition-all">
              <p className="text-[9px] text-zinc-400 font-black uppercase mb-1 tracking-[0.2em] flex items-center justify-center gap-1">Натисни щоб скопіювати <Copy size={10}/></p>
              <p className="text-6xl font-black tracking-[0.2em] group-hover:text-zinc-600 transition-colors">{roomData.id}</p>
              {copied && <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] px-4 py-1.5 rounded-full shadow-xl animate-in fade-in slide-in-from-bottom-2">Скопійовано!</div>}
            </div>
            <div className="space-y-2 text-left max-h-48 overflow-y-auto pr-2 custom-scroll">
              {roomData.players.map(p => (<div key={p.id} className="bg-zinc-50 rounded-2xl p-4 flex justify-between items-center font-bold uppercase text-xs border border-zinc-100"><span>{p.name}</span>{p.id === roomData.hostId && <span className="text-[8px] bg-zinc-900 text-white px-2 py-1 rounded-md font-black uppercase tracking-tighter">Host</span>}</div>))}
            </div>
            {roomData.hostId === user.uid && (
              <div className="space-y-4 pt-4">
                <button onClick={addBot} className="w-full h-14 bg-stone-100 text-zinc-600 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 flex items-center justify-center gap-2 border border-zinc-200">
                   <Plus size={20}/> Додати бота
                </button>
                <button onClick={startGame} disabled={roomData.players.length < 2} className="w-full bg-zinc-900 text-white rounded-[1.5rem] p-5 font-black uppercase tracking-widest disabled:opacity-20 shadow-xl shadow-zinc-900/30">Почати гру</button>
              </div>
            )}
            {roomData.hostId !== user.uid && <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest animate-pulse">Очікуємо хоста...</p>}
          </div>
        )}
      </div>
    );
  }

  // --- GAME HELPERS ---
  const isMyTurn = roomData.players[roomData.turnIndex].id === user.uid;
  const myHand = roomData.playerHands[user.uid] || [];
  const pileSize = roomData.pile.reduce((acc, p) => acc + p.cards.length, 0);
  const lastPlay = roomData.pile[roomData.pile.length - 1];
  const lastPlayCount = lastPlay?.cards?.length || 0;
  const lastPlayerName = roomData.players.find(p => p.id === lastPlay?.playerId)?.name || 'Хтось';
  
  const currentPhrase = roomData.currentClaim 
    ? String(CLAIM_PHRASES[roomData.claimPhraseIndex || 0]
        .replace('{name}', lastPlayerName)
        .replace('{countWord}', countToWord(lastPlayCount))
        .replace('{value}', roomData.currentClaim))
    : null;

  const sortedHand = [...myHand].sort((a, b) => {
    if (a.type === CARD_TYPES.STANDARD && b.type !== CARD_TYPES.STANDARD) return -1;
    if (a.type !== CARD_TYPES.STANDARD && b.type === CARD_TYPES.STANDARD) return 1;
    if (a.type === CARD_TYPES.STANDARD && b.type === CARD_TYPES.STANDARD) return a.value - b.value;
    return a.type.localeCompare(b.type);
  });

  if (roomData.winnerId) {
    const winnerName = roomData.players.find(p => p.id === roomData.winnerId).name;
    return (
      <div className="h-dvh w-full fixed inset-0 bg-zinc-900 text-white flex flex-col items-center justify-center p-6 text-center font-mono overflow-hidden">
        <h1 className="text-6xl font-black mb-4 uppercase italic tracking-tighter">BLK<br/>{winnerName}<br/>WIN!</h1>
        {roomData.hostId === user.uid && <button onClick={startGame} className="mt-12 bg-white text-zinc-900 rounded-3xl px-12 py-5 font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all">Restart</button>}
      </div>
    );
  }

  return (
    <div className="h-dvh w-full fixed inset-0 bg-stone-100 text-zinc-900 font-mono flex flex-col overflow-hidden touch-none">
      
      {/* ПОВІДОМЛЕННЯ (ЗАЯВЛЕНА ФРАЗА) - ФІКСОВАНО ЗВЕРХУ НА ЧОРНОМУ */}
      <div className={`absolute top-0 w-full bg-black text-white p-4 z-[110] text-center shadow-2xl transition-all duration-500 ${currentPhrase ? 'translate-y-0' : '-translate-y-full opacity-0'}`}>
         <p className="text-[11px] font-black uppercase tracking-[0.05em] leading-tight italic">{currentPhrase}</p>
      </div>

      {/* ТОСТИ (ПОДІЇ ЯК ВГАДАВ/БРЕХНЯ) - ТРОХИ НИЖЧЕ */}
      {toast.visible && (
        <div className={`absolute top-16 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-sm p-4 rounded-[2rem] shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-500
          ${toast.type === 'success' ? 'bg-green-500 text-white ring-8 ring-green-500/10' : 
            toast.type === 'error' ? 'bg-red-500 text-white ring-8 ring-red-500/10' : 
            'bg-zinc-900 text-white shadow-zinc-900/20'}`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={24} strokeWidth={2.5}/> : toast.type === 'error' ? <AlertCircle size={24} strokeWidth={2.5}/> : null}
          <p className="text-[11px] font-black uppercase tracking-wider leading-tight">{toast.text}</p>
        </div>
      )}

      {/* ОСНОВНА ІГРОВА ЗОНА */}
      <div className="flex-1 relative flex items-center justify-center p-4 mt-8">
        
        {/* ГРАВЦІ ЗБОКУ ЗЛІВА */}
        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-10">
          {roomData.players.map(p => {
            if (p.id === user.uid) return null;
            const isTurn = roomData.players[roomData.turnIndex].id === p.id;
            return (
              <div key={p.id} className={`flex flex-col items-center transition-all duration-300 ${isTurn ? 'scale-110 opacity-100' : 'scale-90 opacity-40'}`}>
                <div className="relative w-8 h-12 shadow-md rotate-[-2deg]"><CardBack />
                   <div className="absolute -bottom-1 -right-1 bg-zinc-900 text-white rounded-full w-4.5 h-4.5 flex items-center justify-center text-[8px] font-black shadow-lg border border-white/20">{roomData.playerHands[p.id]?.length || 0}</div>
                </div>
                <div className="text-[7px] uppercase font-black mt-1 w-10 truncate text-center tracking-tighter leading-none">{p.name}</div>
              </div>
            );
          })}
        </div>

        {/* ВІДБІЙ ЗБОКУ СПРАВА (НЕНАВ'ЯЗЛИВО) */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 opacity-40">
           <Equal size={16} className="text-zinc-400" />
           <span className="text-[10px] font-black text-zinc-500">{roomData.discardPileCount}</span>
        </div>

        {/* СТІЛ (ЦЕНТР) */}
        <div className="relative flex flex-col items-center">
          {isMyTurn && <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-20 bg-zinc-900 text-white px-5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-xl animate-pulse">Ваш хід</div>}
          
          {roomData.currentClaim && (
            <div className="text-center mb-8 animate-in fade-in duration-700">
              <span className="text-[7.5rem] font-black leading-none tracking-tighter drop-shadow-sm text-zinc-900 select-none">{roomData.currentClaim}</span>
            </div>
          )}

          <div className="relative w-40 h-56 sm:w-48 sm:h-64 shrink-0">
            {pileSize === 0 ? (
              <div className="absolute inset-0 border-[3px] border-dashed border-zinc-200 rounded-[12%] flex flex-col items-center justify-center text-[10px] uppercase font-black text-zinc-300 tracking-widest space-y-2 opacity-60">
                <Plus size={20} /><span>Порожньо</span>
              </div>
            ) : (
              [...Array(Math.min(pileSize, 6))].map((_, i, arr) => {
                const isTop = i === arr.length - 1;
                const rot = isTop ? 0 : Math.sin(i * 123) * 12;
                const offX = isTop ? 0 : Math.cos(i * 456) * 8;
                const offY = isTop ? 0 : Math.sin(i * 789) * 8;
                return (
                  <div key={i} className="absolute top-1/2 left-1/2 w-full h-full shadow-2xl transition-all duration-500" 
                       style={{ transform: `translate(-50%, -50%) translate(${offX}px, ${offY}px) rotate(${rot}deg)`, zIndex: i }}>
                    <CardBack />
                  </div>
                );
              })
            )}
            {pileSize > 0 && (
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-center font-black text-[10px] z-20 text-zinc-400 uppercase tracking-widest bg-stone-100 px-4 py-1.5 rounded-full border border-zinc-200 shadow-sm whitespace-nowrap">Стіл: {pileSize}</div>
            )}
          </div>
        </div>

        {!isMyTurn && <div className="absolute bottom-4 bg-white/60 backdrop-blur-md px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse border border-white shadow-sm">Думає {roomData.players[roomData.turnIndex].name}...</div>}
      </div>

      {/* ЗОНА РУКИ ТА ДІЙ */}
      <div className={`bg-white border-t border-zinc-200/50 shadow-[0_-20px_50px_rgba(0,0,0,0.08)] z-30 transition-all duration-500 ease-in-out shrink-0 flex flex-col relative ${isMyTurn ? 'h-[48%]' : 'h-[175px] opacity-70 grayscale-[0.2]'}`}>
        
        <div className={`flex gap-3 px-4 pt-4 shrink-0 transition-all duration-500 overflow-hidden ${isMyTurn ? 'h-20 opacity-100' : 'h-0 opacity-0'}`}>
          {roomData.phase === 'NEW_ROUND' ? (
            <button onClick={() => setShowClaimModal(true)} disabled={selectedCards.length === 0} className="flex-1 h-14 bg-zinc-900 text-white rounded-[1.5rem] font-black uppercase tracking-widest disabled:opacity-20 active:scale-95 transition-all shadow-xl shadow-zinc-900/20">ПОКЛАСТИ ({selectedCards.length})</button>
          ) : (
            <>
              <button onClick={() => submitPlayCards(roomData.currentClaim)} disabled={selectedCards.length === 0} className="flex-1 h-14 bg-zinc-900 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest active:scale-95 shadow-xl shadow-zinc-900/20">ДОДАТИ</button>
              <button onClick={() => submitAction('BELIEVE')} className="flex-1 h-14 border-[3.5px] border-zinc-900 rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all">ВІРЮ</button>
              <button onClick={() => submitAction('DISBELIEVE')} className="flex-1 h-14 bg-red-600 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest active:scale-95 shadow-xl shadow-red-600/20">БРЕХНЯ</button>
            </>
          )}
        </div>

        <div className="flex-1 w-full relative overflow-x-auto snap-x hide-scrollbar flex items-center px-10 touch-pan-x">
          <div className="flex flex-nowrap items-center h-full">
            {sortedHand.map((card, idx) => {
              const isSelected = selectedCards.some(c => c.id === card.id);
              const overlap = isMyTurn ? -32 : -21;
              const cardW = isMyTurn ? 'w-[130px]' : 'w-[85px]';
              const cardH = isMyTurn ? 'h-[190px]' : 'h-[125px]';
              return (
                <div key={card.id} onClick={() => toggleCard(card)}
                  className={`snap-center flex-none ${cardW} ${cardH} cursor-pointer transition-all duration-300 relative group`}
                  style={{ marginLeft: idx === 0 ? '0' : `${overlap}px`, zIndex: isSelected ? 100 : idx, transform: isSelected ? 'translateY(-40px)' : 'translateY(0px)' }}
                >
                  <CardFace card={card} isSelected={isSelected} />
                </div>
              );
            })}
            <div className="flex-none w-24 h-10"></div>
          </div>
        </div>
        <div className="pb-safe shrink-0"></div>
      </div>

      {/* REVEAL MODAL (EYE) */}
      {roomData.revealedCardsTo === user.uid && roomData.revealedCards && (
        <div className="absolute inset-0 bg-white/98 backdrop-blur-md z-[150] flex flex-col items-center justify-center p-6 animate-in zoom-in duration-300">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-10 text-zinc-400">👁 ОКО ПОБАЧИЛО:</p>
          <div className="flex gap-4">{roomData.revealedCards.map((c, i) => (<div key={i} className="w-24 h-36 animate-in slide-in-from-bottom-4 duration-500"><CardFace card={c} isSelected={false} /></div>))}</div>
          <button onClick={() => { updateDoc(doc(db, 'artifacts', gameAppId, 'public', 'data', 'rooms', roomId), { revealedCardsTo: null, revealedCards: null }); playSound('click'); }} className="mt-12 bg-zinc-900 text-white rounded-3xl px-12 py-5 text-[10px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all">Зрозумів</button>
        </div>
      )}

      {/* МОДАЛКА ВИБОРУ (ЗАЯВИТИ ЯК) - ВЕЛИЧЕЗНІ КНОПКИ */}
      {showClaimModal && (
        <div className="absolute inset-0 bg-white z-[300] flex flex-col items-center justify-center p-4 animate-in fade-in slide-in-from-bottom-10 duration-300">
          <button onClick={() => { setShowClaimModal(false); playSound('click'); }} className="absolute top-6 right-6 p-4 text-zinc-300 hover:text-zinc-900 transition-colors bg-zinc-50 rounded-full shadow-lg z-10"><X size={44}/></button>
          
          <div className="w-full h-full flex flex-col justify-center max-w-lg">
            <p className="text-center text-[11px] font-black uppercase tracking-[0.5em] mt-10 mb-6 text-zinc-400 italic">Заявити як:</p>
            
            <div className="grid grid-cols-2 gap-4 flex-1 max-h-[75%] overflow-y-auto hide-scrollbar pb-4">
              {[1,2,3,4,5,6,7,8,9,10].map(val => (
                <button 
                  key={val} 
                  onClick={() => submitPlayCards(val)} 
                  className="h-24 sm:h-32 bg-stone-50 border-2 border-zinc-100 rounded-[2rem] flex items-center justify-center text-6xl font-light text-zinc-800 shadow-sm active:bg-zinc-900 active:text-white transition-all transform active:scale-90"
                >
                  {val}
                </button>
              ))}
            </div>

            {selectedCards.length === 1 && [CARD_TYPES.DISCARD, CARD_TYPES.EYE].includes(selectedCards[0].type) && (
              <div className="mt-6 space-y-3 animate-in slide-in-from-bottom-4 duration-500 mb-6">
                {selectedCards[0].type === CARD_TYPES.DISCARD && (
                  <button onClick={() => submitSpecialCard(CARD_TYPES.DISCARD)} className="w-full py-5 bg-zinc-900 text-white rounded-[1.8rem] flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest active:scale-95 shadow-2xl shadow-zinc-900/30"><Equal size={22}/> КИНУТИ ВІДБІЙ</button>
                )}
                {selectedCards[0].type === CARD_TYPES.EYE && (
                  <button onClick={() => submitSpecialCard(CARD_TYPES.EYE)} className="w-full py-5 bg-zinc-900 text-white rounded-[1.8rem] flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest active:scale-95 shadow-2xl shadow-zinc-900/30"><Eye size={22}/> ВИКОРИСТАТИ ОКО</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
        @keyframes drop { 0% { transform: translate(-50%, -120%) scale(1.2); opacity: 0; } 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
        .animate-drop { animation: drop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        body { overflow: hidden; overscroll-behavior: none; position: fixed; width: 100%; height: 100%; font-family: 'Space Grotesk', sans-serif; }
        html { overflow: hidden; }
      `}} />
    </div>
  );
}
