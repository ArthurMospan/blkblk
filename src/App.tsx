// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Eye, X, Equal, Plus } from 'lucide-react';
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
const gameAppId = 'blk-blk-live-game-v1';

const CLAIM_PHRASES = [
  "{name} базарить, шо тут", "{name} отвічає, це", "Зуб даю, тут", "Бля буду, це",
  "{name} мамой клянеться, шо тут", "Залізобетонно тут", "Інфа сотка, це",
  "Сто пудів тут", "Не парся, тут", "{name} стелить, шо це"
];

const CARD_TYPES = { STANDARD: 'standard', MARKED: 'X', CHAMELEON: 'chameleon', DISCARD: '=', EYE: 'eye' };

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
  return deck.sort(() => Math.random() - 0.5);
};

const generateRoomCode = () => Math.random().toString(36).substring(2, 6).toUpperCase();

const CardBack = () => (
  <div className="w-full h-full bg-[#111] rounded-[10%] border-[3px] border-[#0a0a0a] flex items-center justify-center shadow-lg relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
    <div className="flex flex-col items-start transform -skew-x-[15deg]">
      <span className="text-white font-black text-3xl leading-[0.8] tracking-tighter italic font-sans">BLK</span>
      <span className="text-white font-black text-3xl leading-[0.8] tracking-tighter italic font-sans">BLK</span>
    </div>
  </div>
);

const CardFace = ({ card, isSelected }) => {
  const bgClass = isSelected ? 'bg-white shadow-[0_20px_40px_rgba(0,0,0,0.3)]' : 'bg-[#111] shadow-xl';
  const textClass = isSelected ? 'text-black' : 'text-white';
  const borderClass = isSelected ? 'border-white' : 'border-[#0a0a0a] border-[3px]';

  if (card.type === CARD_TYPES.CHAMELEON) {
    return (
      <div className={`w-full h-full rounded-[10%] relative overflow-hidden transition-all duration-300 ${isSelected ? 'bg-white shadow-2xl' : 'bg-[#111] border-[3px] border-[#0a0a0a] shadow-xl'}`}>
         {!isSelected && <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>}
      </div>
    );
  }

  let centerContent, cornerContentTop, cornerContentBottom;
  if (card.type === CARD_TYPES.STANDARD) {
    const is6or9 = card.value === 6 || card.value === 9;
    const underlineColor = isSelected ? 'bg-black' : 'bg-white';
    const fontStyle = { fontFamily: "'Space Grotesk', 'Outfit', sans-serif" };
    
    centerContent = (
      <div className="flex flex-col items-center justify-center h-full pt-1">
        <span className="text-[5rem] sm:text-7xl font-light font-sans tracking-tighter" style={fontStyle}>{card.value}</span>
        {is6or9 && <div className={`w-10 h-[3px] mt-1 ${underlineColor}`}></div>}
      </div>
    );
    cornerContentTop = (
      <div className="absolute top-3 left-4 flex flex-col items-center">
        <span className="font-light text-xl leading-none" style={fontStyle}>{card.value}</span>
        {is6or9 && <div className={`w-4 h-[2px] mt-[2px] ${underlineColor}`}></div>}
      </div>
    );
    cornerContentBottom = (
      <div className="absolute bottom-3 right-4 flex flex-col items-center rotate-180">
        <span className="font-light text-xl leading-none" style={fontStyle}>{card.value}</span>
        {is6or9 && <div className={`w-4 h-[2px] mt-[2px] ${underlineColor}`}></div>}
      </div>
    );
  } else if (card.type === CARD_TYPES.MARKED) {
    centerContent = <X size={64} strokeWidth={1} color="currentColor" />;
    cornerContentTop = <div className="absolute top-3 left-3"><X size={20} strokeWidth={1.5} color="currentColor" /></div>;
    cornerContentBottom = <div className="absolute bottom-3 right-3 rotate-180"><X size={20} strokeWidth={1.5} color="currentColor" /></div>;
  } else if (card.type === CARD_TYPES.DISCARD) {
    centerContent = <Equal size={64} strokeWidth={1} color="currentColor" />;
    cornerContentTop = <div className="absolute top-3 left-3"><Equal size={20} strokeWidth={1.5} color="currentColor" /></div>;
    cornerContentBottom = <div className="absolute bottom-3 right-3 rotate-180"><Equal size={20} strokeWidth={1.5} color="currentColor" /></div>;
  } else if (card.type === CARD_TYPES.EYE) {
    centerContent = <Eye size={64} strokeWidth={1} color="currentColor" />;
    cornerContentTop = <div className="absolute top-3 left-3"><Eye size={20} strokeWidth={1.5} color="currentColor" /></div>;
    cornerContentBottom = <div className="absolute bottom-3 right-3 rotate-180"><Eye size={20} strokeWidth={1.5} color="currentColor" /></div>;
  }

  return (
    <div className={`w-full h-full rounded-[10%] ${bgClass} ${textClass} ${borderClass} flex flex-col items-center justify-center relative transition-all duration-300`}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;700&display=swap');`}</style>
      {!isSelected && <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-[10%] pointer-events-none"></div>}
      {cornerContentTop}{centerContent}{cornerContentBottom}
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
  const [toast, setToast] = useState({ text: '', visible: false, id: 0 });

  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = 'https://cdn.tailwindcss.com';
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error(err));
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !roomId) return;
    const currentRoomRef = doc(db, 'artifacts', gameAppId, 'rooms', roomId);
    
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
          setToast({ text: data.lastEvent.text, visible: true, id: data.lastEvent.ts });
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

  const createRoom = async () => {
    if (!userName.trim()) { setError("Введіть ім'я"); return; }
    const code = generateRoomCode();
    await setDoc(doc(db, 'artifacts', gameAppId, 'rooms', code), {
      id: code, hostId: user.uid, status: 'lobby',
      players: [{ id: user.uid, name: userName, isBot: false }],
      playerHands: {}, turnIndex: 0, phase: 'NEW_ROUND', pile: [],
      discardPileCount: 0, currentClaim: null, winnerId: null,
      revealedCardsTo: null, revealedCards: null, lastEvent: null, claimPhraseIndex: 0
    });
    setRoomId(code); setError('');
  };

  const joinRoom = async () => {
    if (!userName.trim() || !joinCode.trim()) { setError("Введіть дані"); return; }
    const code = joinCode.toUpperCase();
    const joinRoomRef = doc(db, 'artifacts', gameAppId, 'rooms', code);
    const snap = await getDoc(joinRoomRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.status !== 'lobby') { setError("Гра йде"); return; }
      if (!data.players.find(p => p.id === user.uid)) {
        await updateDoc(joinRoomRef, { players: [...data.players, { id: user.uid, name: userName, isBot: false }] });
      }
      setRoomId(code); setError('');
    } else { setError("Кімнату не знайдено"); }
  };

  const addBot = async () => {
    const currentRoomRef = doc(db, 'artifacts', gameAppId, 'rooms', roomId);
    const botNum = roomData.players.filter(p => p.isBot).length + 1;
    await updateDoc(currentRoomRef, { players: [...roomData.players, { id: `bot_${Date.now()}`, name: `БОТ ${botNum}`, isBot: true }] });
  };

  const startGame = async () => {
    const deck = createDeck();
    const numPlayers = roomData.players.length;
    const cardsPerPlayer = Math.floor(48 / numPlayers);
    const hands = {};
    roomData.players.forEach((p, index) => {
      hands[p.id] = deck.slice(index * cardsPerPlayer, (index + 1) * cardsPerPlayer);
    });
    await updateDoc(doc(db, 'artifacts', gameAppId, 'rooms', roomId), {
      status: 'playing', playerHands: hands, turnIndex: 0, phase: 'NEW_ROUND',
      pile: [], discardPileCount: 0, winnerId: null, currentClaim: null,
      revealedCardsTo: null, revealedCards: null, lastEvent: { text: 'Гру розпочато!', ts: Date.now() }, claimPhraseIndex: 0
    });
  };

  const checkWin = (hands) => Object.keys(hands).find(uid => hands[uid].length === 0) || null;

  const submitPlayCards = async (claim, playerId = user.uid, cards = selectedCards) => {
    if (!roomId) return;
    const roomDocRef = doc(db, 'artifacts', gameAppId, 'rooms', roomId);
    const newHand = roomData.playerHands[playerId].filter(c => !cards.some(sc => sc.id === c.id));
    const newHands = { ...roomData.playerHands, [playerId]: newHand };
    const newPile = [...roomData.pile, { playerId, cards, claimValue: claim }];
    
    await updateDoc(roomDocRef, {
      playerHands: newHands, pile: newPile, currentClaim: claim, phase: 'RESPOND',
      turnIndex: (roomData.turnIndex + 1) % roomData.players.length, winnerId: checkWin(newHands),
      revealedCardsTo: null, revealedCards: null, claimPhraseIndex: Math.floor(Math.random() * CLAIM_PHRASES.length)
    });
    if (playerId === user.uid) { setSelectedCards([]); setShowClaimModal(false); }
  };

  const submitAction = async (action, playerId = user.uid) => {
    if (!roomId) return;
    const roomDocRef = doc(db, 'artifacts', gameAppId, 'rooms', roomId);
    let newHands = { ...roomData.playerHands };
    let newPile = [...roomData.pile];
    let newDiscardCount = roomData.discardPileCount;
    let nextTurn = roomData.turnIndex;

    const lastPlay = newPile[newPile.length - 1];
    const isTruth = lastPlay.cards.every(c => c.value === lastPlay.claimValue || c.type === CARD_TYPES.CHAMELEON);
    const currName = roomData.players.find(p => p.id === playerId)?.name || 'Гравець';
    const prevName = roomData.players.find(p => p.id === lastPlay.playerId)?.name || 'Попередній';
    let eventMsg = '';

    const givePileTo = (targetUid) => {
      newHands[targetUid] = [...newHands[targetUid], ...newPile.flatMap(p => p.cards)];
      newPile = [];
    };

    if (action === 'BELIEVE') {
      if (isTruth) {
        eventMsg = `✅ ${currName} каже "ВІРЮ" і ВГАДУЄ!`;
        newDiscardCount += newPile.reduce((acc, p) => acc + p.cards.length, 0);
        newPile = []; nextTurn = roomData.turnIndex;
      } else {
        eventMsg = `❌ ${currName} помиляється (це брехня)! Забирає карти.`;
        givePileTo(playerId); nextTurn = (roomData.turnIndex + 1) % roomData.players.length;
      }
    } else {
      if (!isTruth) {
        eventMsg = `✅ ${currName} каже "БРЕХНЯ" і ВГАДУЄ! ${prevName} забирає карти.`;
        givePileTo(lastPlay.playerId); nextTurn = roomData.turnIndex;
      } else {
        eventMsg = `❌ ${currName} каже "БРЕХНЯ", але помиляється! Забирає карти.`;
        givePileTo(playerId); nextTurn = (roomData.turnIndex + 1) % roomData.players.length;
      }
    }

    await updateDoc(roomDocRef, {
      playerHands: newHands, pile: newPile, discardPileCount: newDiscardCount,
      turnIndex: nextTurn, phase: 'NEW_ROUND', currentClaim: null, winnerId: checkWin(newHands),
      revealedCardsTo: null, revealedCards: null, lastEvent: { text: eventMsg, ts: Date.now() }
    });
    if (playerId === user.uid) setSelectedCards([]);
  };

  const submitSpecialCard = async (cardType, playerId = user.uid) => {
    if (!roomId) return;
    const roomDocRef = doc(db, 'artifacts', gameAppId, 'rooms', roomId);
    const currName = roomData.players.find(p => p.id === playerId)?.name || 'Гравець';
    const playedCard = roomData.playerHands[playerId].find(c => c.type === cardType);
    const newHand = roomData.playerHands[playerId].filter(c => c.id !== playedCard.id);
    const newHands = { ...roomData.playerHands, [playerId]: newHand };
    
    let updates = { playerHands: newHands, winnerId: checkWin(newHands) };

    if (cardType === CARD_TYPES.DISCARD) {
      updates.discardPileCount = roomData.discardPileCount + roomData.pile.reduce((acc, p) => acc + p.cards.length, 0) + 1;
      updates.pile = []; updates.phase = 'NEW_ROUND';
      updates.lastEvent = { text: `⚡ ${currName} кидає ВІДБІЙ!`, ts: Date.now() };
    } else if (cardType === CARD_TYPES.EYE) {
      updates.discardPileCount = roomData.discardPileCount + 1;
      updates.revealedCardsTo = playerId;
      updates.revealedCards = roomData.pile[roomData.pile.length - 1].cards;
      updates.lastEvent = { text: `👁 ${currName} використовує ОКО.`, ts: Date.now() };
    }

    await updateDoc(roomDocRef, updates);
    if (playerId === user.uid) setSelectedCards([]);
  };

  useEffect(() => {
    if (!roomData || roomData.status !== 'playing' || roomData.winnerId || roomData.hostId !== user?.uid) return;
    const currentPlayer = roomData.players[roomData.turnIndex];
    if (!currentPlayer || !currentPlayer.isBot) return;

    const botId = currentPlayer.id;
    const hand = roomData.playerHands[botId];
    if (!hand) return;

    const timer = setTimeout(() => {
      const pileSize = roomData.pile.reduce((acc, p) => acc + p.cards.length, 0);

      if (roomData.phase === 'NEW_ROUND') {
        const cardsToPlay = hand.slice(0, Math.min(Math.floor(Math.random() * 2) + 1, hand.length));
        let claim = Math.floor(Math.random() * 10) + 1;
        if (Math.random() > 0.3 && cardsToPlay[0].type === CARD_TYPES.STANDARD) claim = cardsToPlay[0].value;
        submitPlayCards(claim, botId, cardsToPlay);
      } else {
        const hasDiscard = hand.some(c => c.type === CARD_TYPES.DISCARD);
        const hasEye = hand.some(c => c.type === CARD_TYPES.EYE);

        if (hasDiscard && pileSize > 3 && Math.random() > 0.5) return submitSpecialCard(CARD_TYPES.DISCARD, botId);
        if (hasEye && Math.random() > 0.7 && roomData.revealedCardsTo !== botId) return submitSpecialCard(CARD_TYPES.EYE, botId);
        
        if (roomData.revealedCardsTo === botId) {
           const isTruth = roomData.revealedCards.every(c => c.value === roomData.currentClaim || c.type === CARD_TYPES.CHAMELEON);
           return isTruth ? submitAction('BELIEVE', botId) : submitAction('DISBELIEVE', botId);
        }

        const matchingCards = hand.filter(c => c.value === roomData.currentClaim || c.type === CARD_TYPES.CHAMELEON);
        if (matchingCards.length > 0 && Math.random() > 0.7) return submitPlayCards(roomData.currentClaim, botId, [matchingCards[0]]);

        if (Math.random() > 0.5 || pileSize > 5) submitAction('DISBELIEVE', botId);
        else submitAction('BELIEVE', botId);
      }
    }, 1800);

    return () => clearTimeout(timer);
  }, [roomData, user]);

  const toggleCard = (card) => {
    if (selectedCards.some(c => c.id === card.id)) setSelectedCards(selectedCards.filter(c => c.id !== card.id));
    else setSelectedCards([...selectedCards, card]);
  };

  if (!user) return <div className="h-dvh bg-stone-50 text-zinc-800 flex items-center justify-center font-mono font-bold uppercase tracking-widest">З'єднання...</div>;

  if (!roomData || roomData.status === 'lobby') {
    return (
      <div className="h-dvh bg-gradient-to-br from-stone-50 via-stone-100 to-stone-200 text-zinc-900 font-mono flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <h1 className="flex flex-col transform -skew-x-[12deg] mb-12 relative z-10 drop-shadow-md">
          <span className="text-7xl font-black leading-[0.8] tracking-tighter font-sans italic">BLK</span>
          <span className="text-7xl font-black leading-[0.8] tracking-tighter font-sans italic text-zinc-700 ml-2">BLK</span>
        </h1>
        {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 mb-6 w-full max-w-sm uppercase text-xs font-bold rounded-2xl text-center z-10 shadow-sm">{error}</div>}

        {!roomData ? (
          <div className="w-full max-w-sm space-y-5 z-10 bg-white/60 backdrop-blur-xl p-6 rounded-3xl shadow-xl border border-white/50">
            <input className="w-full bg-white/80 rounded-2xl p-4 text-lg outline-none text-center uppercase placeholder:text-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-900 transition-all shadow-sm" placeholder="ТВОЄ ІМ'Я" value={userName} onChange={e => setUserName(e.target.value)} />
            <div className="grid grid-cols-2 gap-4">
              <button onClick={createRoom} className="bg-zinc-900 text-white rounded-2xl p-4 uppercase font-bold text-base shadow-lg hover:shadow-xl active:scale-95 transition-all">СТВОРИТИ</button>
              <div className="flex flex-col gap-2">
                <input className="w-full bg-white/80 rounded-xl p-3 text-lg outline-none text-center uppercase placeholder:text-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-900 shadow-sm transition-all" placeholder="КОД" maxLength={4} value={joinCode} onChange={e => setJoinCode(e.target.value)} />
                <button onClick={joinRoom} className="bg-white text-zinc-900 rounded-xl p-3 font-bold uppercase shadow-sm border border-zinc-100 active:scale-95 transition-all">УВІЙТИ</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-sm bg-white/80 backdrop-blur-xl rounded-3xl p-8 text-center space-y-8 z-10 shadow-xl border border-white/50">
            <div>
              <p className="text-zinc-400 uppercase text-xs font-bold tracking-widest mb-2">Код кімнати</p>
              <div className="text-6xl font-black tracking-widest text-zinc-800">{roomData.id}</div>
            </div>
            <div className="space-y-3">
              <p className="text-zinc-400 uppercase text-xs font-bold text-left tracking-widest">Гравці ({roomData.players.length}):</p>
              {roomData.players.map(p => (
                <div key={p.id} className="bg-white rounded-2xl p-4 text-left uppercase flex justify-between items-center shadow-sm border border-zinc-100">
                  <span className="font-bold text-zinc-800">{p.name} {p.isBot && <span className="text-zinc-400 text-xs ml-1">(Бот)</span>}</span>
                  {p.id === roomData.hostId && <span className="bg-zinc-100 text-zinc-600 text-[10px] px-3 py-1 rounded-full font-bold">ХОСТ</span>}
                </div>
              ))}
            </div>
            {roomData.hostId === user.uid && (
              <div className="flex flex-col gap-3 pt-4">
                {roomData.players.length < 4 && <button onClick={addBot} className="bg-zinc-50 text-zinc-500 rounded-2xl p-3 text-sm font-bold uppercase hover:bg-zinc-100 transition-colors">+ ДОДАТИ БОТА</button>}
                <button onClick={startGame} disabled={roomData.players.length < 2} className="w-full bg-zinc-900 text-white rounded-2xl p-4 text-lg font-bold uppercase shadow-lg disabled:opacity-40 active:scale-95 transition-all">РОЗПОЧАТИ ГРУ</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const isMyTurn = roomData.players[roomData.turnIndex].id === user.uid;
  const myHand = roomData.playerHands[user.uid] || [];
  const pileSize = roomData.pile.reduce((acc, p) => acc + p.cards.length, 0);
  
  const lastPlayerId = roomData.pile[roomData.pile.length - 1]?.playerId;
  const lastPlayerName = roomData.players.find(p => p.id === lastPlayerId)?.name || 'Хтось';
  const currentPhrase = CLAIM_PHRASES[roomData.claimPhraseIndex || 0].replace('{name}', lastPlayerName);

  if (roomData.winnerId) {
    return (
      <div className="h-dvh bg-gradient-to-br from-stone-50 via-stone-100 to-stone-200 text-zinc-900 font-mono flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-6xl font-black mb-4 uppercase text-zinc-800">{roomData.players.find(p => p.id === roomData.winnerId).name}<br/>ПЕРЕМАГАЄ!</h1>
        <p className="text-zinc-400 font-bold mb-12 tracking-widest uppercase">ГРА ЗАВЕРШЕНА</p>
        {roomData.hostId === user.uid && <button onClick={startGame} className="bg-zinc-900 text-white rounded-2xl p-4 px-10 text-lg font-bold uppercase shadow-xl active:scale-95 transition-all">НОВА ГРА</button>}
      </div>
    );
  }

  return (
    <div className="h-dvh bg-gradient-to-br from-stone-50 via-stone-100 to-stone-200 text-zinc-900 font-mono flex flex-col overflow-hidden relative">
      {toast.visible && (
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm bg-zinc-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl animate-in slide-in-from-top-4 fade-in duration-300 flex flex-col items-center text-center pointer-events-none">
          <p className="font-bold uppercase tracking-wide text-xs leading-relaxed">{toast.text}</p>
        </div>
      )}

      {/* Шапка гравців */}
      <div className="flex-none p-4 pt-8 flex justify-center items-start gap-6 overflow-x-auto snap-x hide-scrollbar z-10">
        {roomData.players.map(p => {
          if (p.id === user.uid) return null;
          const isTurn = roomData.players[roomData.turnIndex].id === p.id;
          return (
            <div key={p.id} className={`snap-center flex flex-col items-center transition-all duration-300 ${isTurn ? 'scale-110 opacity-100 translate-y-2' : 'scale-90 opacity-40'}`}>
              <div className={`text-[10px] uppercase font-bold truncate w-24 text-center mb-2 tracking-wider ${isTurn ? 'text-zinc-800' : 'text-zinc-500'}`}>{p.name}</div>
              <div className="relative w-12 h-16 shadow-md transform rotate-[-5deg] rounded-2xl">
                 <CardBack />
                 <div className="absolute -bottom-2 -right-2 bg-white text-zinc-900 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-sm border border-zinc-100">{roomData.playerHands[p.id]?.length || 0}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Зона столу: Змінюється залежно від того, чий хід */}
      <div className={`flex flex-col items-center justify-center relative transition-all duration-500 ease-in-out ${isMyTurn ? 'p-2 mt-2 shrink-0' : 'flex-1 p-4'}`}>
        <div className="absolute top-4 right-4 bg-white/60 backdrop-blur-md rounded-full px-3 py-1.5 flex items-center gap-2 shadow-sm z-10 border border-white">
          <Equal size={14} className="text-zinc-400" />
          <span className="text-xs font-bold text-zinc-600">{roomData.discardPileCount}</span>
        </div>

        {isMyTurn ? (
          // ЕКРАН "ВАШ ХІД" (Стіл схований)
          <div className="flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-300">
            <h2 className="text-4xl font-black text-zinc-900 uppercase tracking-widest mb-3 drop-shadow-sm">Ваш хід</h2>
            {roomData.phase === 'RESPOND' ? (
              <div className="bg-white/90 backdrop-blur-md rounded-3xl px-8 py-3 shadow-lg border border-white flex flex-col items-center">
                 <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest mb-1">Заявлено:</span>
                 <span className="text-6xl font-black text-zinc-800 leading-none">{roomData.currentClaim}</span>
                 <div className="mt-2 bg-zinc-100 text-zinc-500 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">На столі: {pileSize}</div>
              </div>
            ) : (
              <div className="bg-white/80 backdrop-blur-md rounded-full px-6 py-2 shadow-sm border border-white text-xs text-zinc-500 font-bold uppercase tracking-widest">
                 Покладіть карту на стіл
              </div>
            )}
          </div>
        ) : (
          // ЕКРАН ЗІ СТОЛОМ (Чужий хід)
          pileSize === 0 ? (
            <div className="text-zinc-400 border-2 border-dashed border-zinc-300 rounded-[2rem] w-32 h-48 flex items-center justify-center text-center uppercase tracking-widest font-bold z-10 bg-white/30 backdrop-blur-sm">Стіл пустий</div>
          ) : (
            <div className={`flex flex-col items-center z-10 w-full ${pileAnimation}`}>
              <div className="flex flex-col items-center mb-4 px-4 text-center">
                <span className="text-zinc-500 uppercase text-[10px] font-bold tracking-widest mb-1 leading-tight">{currentPhrase}</span>
                <span className="text-7xl font-black text-zinc-800 drop-shadow-sm leading-none">{roomData.currentClaim}</span>
              </div>
              
              {/* Ідеально рівна стопка карт */}
              <div className="relative w-32 h-44 sm:w-40 sm:h-56 mx-auto mt-2">
                {[...Array(Math.min(pileSize, 6))].map((_, i, arr) => {
                  const isTop = i === arr.length - 1;
                  return (
                    <div 
                      key={i} 
                      className="absolute top-1/2 left-1/2 w-full h-full shadow-[0_4px_20px_rgba(0,0,0,0.15)] rounded-[10%] bg-[#111]" 
                      style={{ 
                        transform: `translate(-50%, -50%) ${isTop ? 'rotate(0deg)' : `rotate(${Math.sin(i * 123) * 12}deg)`}`, 
                        zIndex: i 
                      }}
                    >
                      <CardBack />
                    </div>
                  );
                })}
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-center font-bold text-xs z-20 text-zinc-400/80 uppercase tracking-widest whitespace-nowrap">Всього: {pileSize} шт</div>
              </div>

              {roomData.revealedCardsTo === user.uid && roomData.revealedCards && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-xl border border-white p-6 rounded-3xl text-center animate-in zoom-in z-50 shadow-2xl">
                  <div className="text-zinc-800 text-xs font-bold uppercase mb-4 tracking-widest flex items-center justify-center gap-2"><Eye size={18}/> Око побачило:</div>
                  <div className="flex gap-3 justify-center">{roomData.revealedCards.map((c, i) => (<div key={i} className="w-16 h-24"><CardFace card={c} isSelected={false} /></div>))}</div>
                </div>
              )}
            </div>
          )
        )}

        {!isMyTurn && (
          <div className="absolute bottom-4 bg-white/80 backdrop-blur-md rounded-full px-5 py-2 uppercase text-zinc-500 text-[10px] font-bold tracking-widest animate-pulse z-10 flex items-center gap-2 shadow-sm border border-white">
            Думає {roomData.players[roomData.turnIndex].name}...
          </div>
        )}
      </div>

      {/* Зона руки (картки) */}
      <div className={`flex flex-col pb-safe z-20 transition-all duration-500 ease-in-out ${isMyTurn ? 'flex-1 min-h-0' : 'flex-none'}`}>
        
        {/* Кнопки дій */}
        <div className={`px-4 flex gap-2 shrink-0 transition-all duration-500 overflow-hidden ${isMyTurn ? 'mb-2 h-14 opacity-100' : 'h-0 opacity-0 m-0'}`}>
           {isMyTurn && roomData.phase === 'NEW_ROUND' && (
              <button onClick={() => setShowClaimModal(true)} disabled={selectedCards.length === 0} className="flex-1 bg-zinc-900 text-white rounded-2xl uppercase font-bold text-sm tracking-wide shadow-lg active:scale-95 disabled:opacity-30 disabled:scale-100 transition-all">
                ПОКЛАСТИ {selectedCards.length > 0 && `(${selectedCards.length})`}
              </button>
           )}
           {isMyTurn && roomData.phase === 'RESPOND' && (
              <>
                <button onClick={() => submitPlayCards(roomData.currentClaim)} disabled={selectedCards.length === 0} className="flex-1 bg-zinc-900 text-white rounded-2xl uppercase font-bold text-xs tracking-wide shadow-lg active:scale-95 disabled:opacity-30 disabled:scale-100 transition-all">ДОДАТИ</button>
                <button onClick={() => submitAction('BELIEVE')} className="flex-1 bg-white text-zinc-900 rounded-2xl uppercase font-bold text-xs tracking-wide shadow-sm active:scale-95 transition-all border border-zinc-100">ВІРЮ</button>
                <button onClick={() => submitAction('DISBELIEVE')} className="flex-1 bg-white text-zinc-900 rounded-2xl uppercase font-bold text-xs tracking-wide shadow-sm active:scale-95 transition-all border border-zinc-100">БРЕХНЯ</button>
              </>
           )}
        </div>

        {/* Карти в руці */}
        <div className={`relative transition-all duration-500 ${isMyTurn ? 'flex-1 flex flex-col justify-end' : ''}`}>
          <div className={`flex overflow-x-auto snap-x hide-scrollbar items-end transition-all duration-500 w-full ${isMyTurn ? 'px-8 pt-8 pb-16 h-full min-h-[300px]' : 'px-6 pt-12 pb-6 min-h-[160px]'}`}>
            {myHand.map((card, idx) => {
              const isSelected = selectedCards.some(c => c.id === card.id);
              const rotation = (idx - (myHand.length - 1) / 2) * (isMyTurn ? 4 : 5); 
              
              // Розміри: ВЕЛИЧЕЗНІ у свій хід, МАЛЕНЬКІ під час чужого ходу
              const baseWidth = isMyTurn ? 'w-[150px] sm:w-[180px]' : 'w-[80px] sm:w-[100px]';
              const baseHeight = isMyTurn ? 'h-[215px] sm:h-[260px]' : 'h-[115px] sm:h-[145px]';
              const marginL = idx === 0 ? '0' : (isMyTurn ? '-4rem' : '-2.5rem');
              
              let transformStr = '';
              if (isSelected) {
                 // Якщо карта вибрана не у свій хід - вона сильно збільшується і підстрибує
                 transformStr = isMyTurn ? `translateY(-30px)` : `translateY(-60px) scale(1.5)`;
              } else {
                 transformStr = `rotate(${rotation}deg) translateY(${Math.abs(rotation) * (isMyTurn ? 1.5 : 1.0)}px)`;
              }

              return (
                <div key={card.id} onClick={() => toggleCard(card)}
                  className={`snap-center flex-none ${baseWidth} ${baseHeight} cursor-pointer select-none transition-all duration-300 relative origin-bottom ${isSelected ? 'z-50' : 'hover:-translate-y-4 hover:z-30'} ${!isMyTurn && !isSelected ? 'opacity-50' : 'opacity-100'}`}
                  style={{ marginLeft: marginL, transform: transformStr, zIndex: isSelected ? 50 : idx }}
                >
                  <CardFace card={card} isSelected={isSelected} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showClaimModal && (
        <div className="absolute inset-0 bg-stone-100/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-200">
          <button onClick={() => setShowClaimModal(false)} className="absolute top-8 right-8 p-3 text-zinc-500 hover:bg-white rounded-full transition-colors"><X size={32}/></button>
          <div className="flex flex-col items-center w-full max-w-sm">
            <h2 className="text-xl font-black uppercase tracking-widest mb-2 text-center text-zinc-800">ЗАЯВИТИ ЯК:</h2>
            <p className="text-xs text-zinc-400 mb-8 font-bold uppercase tracking-widest">Обрано карт: {selectedCards.length}</p>
            <div className="grid grid-cols-5 gap-3 w-full">
              {[1,2,3,4,5,6,7,8,9,10].map(val => (
                <button key={val} onClick={() => submitPlayCards(val)} className="aspect-square bg-white rounded-2xl flex items-center justify-center text-3xl font-light text-zinc-800 shadow-sm hover:shadow-md active:bg-zinc-900 active:text-white transition-all border border-zinc-100">{val}</button>
              ))}
            </div>
            {selectedCards.length === 1 && selectedCards[0].type !== CARD_TYPES.STANDARD && selectedCards[0].type !== CARD_TYPES.CHAMELEON && selectedCards[0].type !== CARD_TYPES.MARKED && (
               <div className="mt-8 pt-6 w-full flex flex-col gap-3">
                 <p className="text-center text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Або зіграти як дію:</p>
                 {selectedCards[0].type === CARD_TYPES.DISCARD && <button onClick={() => submitSpecialCard(CARD_TYPES.DISCARD)} className="w-full py-4 bg-white rounded-2xl flex items-center justify-center gap-2 font-bold text-sm uppercase shadow-sm border border-zinc-100 active:bg-zinc-900 active:text-white transition-all text-zinc-800"><Equal size={18}/> Використати ВІДБІЙ</button>}
                 {selectedCards[0].type === CARD_TYPES.EYE && <button onClick={() => submitSpecialCard(CARD_TYPES.EYE)} className="w-full py-4 bg-white rounded-2xl flex items-center justify-center gap-2 font-bold text-sm uppercase shadow-sm border border-zinc-100 active:bg-zinc-900 active:text-white transition-all text-zinc-800"><Eye size={18}/> Використати ОКО</button>}
               </div>
            )}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        @keyframes drop { 0% { transform: translateY(-30px) scale(1.05); opacity: 0; } 60% { transform: translateY(5px) scale(0.98); opacity: 1; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
        .animate-drop { animation: drop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
      `}} />
    </div>
  );
}
