import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Button,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  Modal,
  Platform,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const POKEMON_API = 'https://pokeapi.co/api/v2/pokemon?limit=50';

function PokemonScreen() {
  const [url, setUrl] = useState(POKEMON_API);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [nextUrl, setNextUrl] = useState(null);
  const [prevUrl, setPrevUrl] = useState(null);
  const [search, setSearch] = useState('');
  const cacheRef = useRef({});
  const [pokemonDetails, setPokemonDetails] = useState({});

  const fetchData = async (fetchUrl = POKEMON_API, opts = { pull: false }) => {
    setUrl(fetchUrl);
    try {
      if (!opts.pull && !cacheRef.current[fetchUrl]) setLoading(true);
      if (opts.pull) setRefreshing(true);

      if (cacheRef.current[fetchUrl]) {
        const cached = cacheRef.current[fetchUrl];
        setData(cached.results || []);
        setNextUrl(cached.next || null);
        setPrevUrl(cached.previous || null);
        setError(null);
      }

      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const results = json.results || [];
      const details = {};
      await Promise.all(
        results.map(async (pokemon) => {
          try {
            if (cacheRef.current[pokemon.url]) {
              details[pokemon.url] = cacheRef.current[pokemon.url];
              return;
            }
            const detailRes = await fetch(pokemon.url);
            const detailJson = await detailRes.json();
            details[pokemon.url] = detailJson;
            cacheRef.current[pokemon.url] = detailJson;
          } catch (e) {
            console.warn('Error fetching pokemon details:', e);
          }
        })
      );

      cacheRef.current[fetchUrl] = json;
      setData(results);
      setPokemonDetails(details);
      setNextUrl(json.next || null);
      setPrevUrl(json.previous || null);
      setError(null);
    } catch (err) {
      console.warn('Fetch error', err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(POKEMON_API);
  }, []);

  const onRefresh = React.useCallback(() => {
    fetchData(url || POKEMON_API, { pull: true });
  }, [url]);

  const goTo = (target) => {
    if (!target) return;
    setUrl(target);
    if (cacheRef.current[target]) {
      const cached = cacheRef.current[target];
      setData(cached.results || []);
      setNextUrl(cached.next || null);
      setPrevUrl(cached.previous || null);
      setError(null);
      fetchData(target, { pull: false });
    } else {
      fetchData(target, { pull: false });
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data;
    return data.filter((p) => (p.name || '').toLowerCase().includes(term));
  }, [data, search]);

  return (
    <SafeAreaView style={styles.screenContainer}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Pokémon (limit=50)</Text>
      </View>

      <TextInput
        placeholder="Buscar por nombre..."
        value={search}
        onChangeText={setSearch}
        style={styles.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={styles.muted}>Cargando pokemons...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Error de red: {error}</Text>
          <Text style={styles.muted}>Desliza para refrescar y reintentar.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.url}
          refreshing={refreshing}
          onRefresh={onRefresh}
          extraData={search}
          contentContainerStyle={filtered.length === 0 && styles.centered}
          renderItem={({ item }) => {
            const details = pokemonDetails[item.url];
            return (
              <View style={styles.listItem}>
                <View style={styles.pokemonRow}>
                  {details?.sprites?.front_default && (
                    <Image
                      source={{ uri: details.sprites.front_default }}
                      style={styles.pokemonSprite}
                    />
                  )}
                  <View style={styles.pokemonInfo}>
                    <Text style={styles.itemTitle}>{item.name}</Text>
                    {details && (
                      <Text style={styles.pokemonType}>
                        {details.types?.map(t => t.type.name).join(', ')}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={() => (
            <View style={styles.centered}>
              <Text style={styles.muted}>Sin resultados para "{search}"</Text>
            </View>
          )}
        />
      )}

      <View style={styles.paginationRow}>
        <TouchableOpacity
          style={[styles.pageButton, !prevUrl && styles.disabledButton]}
          onPress={() => goTo(prevUrl)}
          disabled={!prevUrl}
        >
          <Text style={styles.pageButtonText}>Previous</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pageButton, !nextUrl && styles.disabledButton]}
          onPress={() => goTo(nextUrl)}
          disabled={!nextUrl}
        >
          <Text style={styles.pageButtonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function QRScreen() {
  const [text, setText] = useState('Hello world');
  const [QRCodeComp, setQRCodeComp] = useState(null);
  const [ScannerComp, setScannerComp] = useState(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scannedValue, setScannedValue] = useState('');
  const [scannedModalVisible, setScannedModalVisible] = useState(false);
  const scanHandledRef = useRef(false);
  const [clipboardAvailable, setClipboardAvailable] = useState(false);
  const [scanHistory, setScanHistory] = useState([]);
  const [parsedPayment, setParsedPayment] = useState(null);
  const [historyVisible, setHistoryVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const history = await AsyncStorage.getItem('@qr_history');
        if (history) setScanHistory(JSON.parse(history));
      } catch (e) {
        console.warn('Error loading scan history:', e);
      }
    })();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import('react-native-qrcode-svg');
        if (mounted) setQRCodeComp(() => mod.default || mod);
      } catch (err) {
        console.warn('react-native-qrcode-svg not available:', err);
        setQRCodeComp(null);
      }
    })();

    (async () => {
      try {
        await import('@react-native-clipboard/clipboard');
        setClipboardAvailable(true);
      } catch (e) {
        setClipboardAvailable(false);
      }
    })();

    return () => (mounted = false);
  }, []);

  const openScanner = async () => {
    try {
      const { BarCodeScanner } = await import('expo-barcode-scanner');
      
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      
      if (status === 'granted') {
        setScannerComp(() => BarCodeScanner);
        setScanning(true);
      } else {
        Alert.alert('Permiso denegado', 'La cámara necesita permisos para escanear.');
      }
    } catch (err) {
      console.error('Error scanner:', err);
      Alert.alert(
        'Error',
        'No se pudo iniciar el scanner. Asegúrate de tener expo-barcode-scanner instalado.'
      );
    }
  };

  const parsePaymentFormat = (text) => {
    try {
      if (!text.startsWith('PAY:')) return null;
      const [id, amount, currency] = text.substring(4).split('|');
      if (!id || !amount || currency !== 'ARS') return null;
      return { id, amount: parseFloat(amount), currency };
    } catch (e) {
      return null;
    }
  };

  const onBarCodeScanned = async ({ data }) => {
    if (scanHandledRef.current) return;
    scanHandledRef.current = true;
    const payment = parsePaymentFormat(data);
    setParsedPayment(payment);
    setScannedValue(data);
    setScanning(false);
    setScannedModalVisible(true);

    try {
      const newHistory = [
        { value: data, timestamp: new Date().toISOString(), payment },
        ...scanHistory,
      ].slice(0, 10); 
      await AsyncStorage.setItem('@qr_history', JSON.stringify(newHistory));
      setScanHistory(newHistory);
    } catch (e) {
      console.warn('Error saving scan history:', e);
    }

    // reset handler after a short delay so scanner can be used again later
    setTimeout(() => (scanHandledRef.current = false), 1000);
  };

  const copyScanned = async () => {
    try {
      const Clip = await import('@react-native-clipboard/clipboard');
      Clip.setString(scannedValue || '');
      Alert.alert('Copiado', 'Valor copiado al portapapeles');
    } catch (err) {
      Alert.alert('No disponible', 'Clipboard no está disponible en este entorno');
    }
  };

  const openHistory = () => {
    setHistoryVisible(true);
  };

  const clearHistory = async () => {
    try {
      await AsyncStorage.removeItem('@qr_history');
      setScanHistory([]);
      Alert.alert('Historial borrado', 'El historial de escaneos ha sido borrado.');
    } catch (e) {
      console.warn('Error clearing history:', e);
      Alert.alert('Error', 'No se pudo borrar el historial.');
    }
  };

  return (
    <SafeAreaView style={styles.screenContainer}>
      <Text style={styles.title}>QR Generator & Scanner</Text>

      <TextInput
        placeholder="Texto para codificar"
        value={text}
        onChangeText={setText}
        style={styles.searchInput}
      />

      <View style={styles.qrBox}>
        {QRCodeComp ? (
          // render QR
          // QRCodeComp expects a value prop
          React.createElement(QRCodeComp, { value: text || ' ' })
        ) : (
          <View style={styles.centered}>
            <Text style={styles.muted}>Instala react-native-qrcode-svg para ver el QR.</Text>
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button title="Escanear" onPress={openScanner} />
        <View style={{ width: 12 }} />
        <Button title="Historial" onPress={openHistory} />
      </View>

        <View style={{ marginTop: 12 }}>
        <Text style={styles.muted}>Último escaneado:</Text>
        <Text selectable style={{ fontSize: 16, marginTop: 6 }}>{scannedValue || '- ningún valor -'}</Text>
        {scannedValue ? (
          <View style={{ marginTop: 8 }}>
            {clipboardAvailable ? (
              <Button title="Copiar" onPress={copyScanned} />
            ) : (
              <Text style={styles.muted}>Clipboard no disponible</Text>
            )}
          </View>
        ) : null}
      </View>

      {/* Modal que muestra el contenido escaneado y evita abrir automáticamente enlaces/archivos */}
      <Modal visible={scannedModalVisible} animationType="slide" transparent={true}>
        <View style={styles.scannedModalBackdrop}>
          <View style={styles.scannedModalBox}>
            <Text style={{ fontWeight: '600', marginBottom: 8 }}>Contenido escaneado</Text>
            <Text selectable style={{ marginBottom: 12 }}>{scannedValue}</Text>
            
            {parsedPayment && (
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentTitle}>Información de Pago</Text>
                <Text>ID: {parsedPayment.id}</Text>
                <Text>Monto: ${parsedPayment.amount}</Text>
                <Text>Moneda: {parsedPayment.currency}</Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Button title="Cerrar" onPress={() => {
                setScannedModalVisible(false);
                setParsedPayment(null);
              }} />
              {!parsedPayment && (
                <Button
                  title="Abrir enlace"
                  onPress={async () => {
                    try {
                      const Linking = await import('react-native').then((m) => m.Linking);
                      if (/^https?:\/\//i.test(scannedValue)) {
                        Linking.openURL(scannedValue);
                      } else {
                        Alert.alert('No es un enlace', 'El contenido no parece ser una URL http/https.');
                      }
                    } catch (err) {
                      Alert.alert('No se pudo abrir', 'Error intentando abrir el enlace.');
                    }
                  }}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* History Modal */}
      <Modal visible={historyVisible} animationType="slide">
        <SafeAreaView style={styles.container}>
          <View style={styles.historyHeader}>
            <Text style={styles.title}>Historial de escaneos</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="Borrar historial" onPress={clearHistory} />
              <Button title="Cerrar" onPress={() => setHistoryVisible(false)} />
            </View>
          </View>
          {scanHistory.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.muted}>No hay escaneos en el historial.</Text>
            </View>
          ) : (
            <FlatList
              data={scanHistory}
              keyExtractor={(item) => item.timestamp}
              renderItem={({ item }) => (
                <View style={styles.historyItem}>
                  <Text style={styles.historyTimestamp}>
                    {new Date(item.timestamp).toLocaleString()}
                  </Text>
                  <Text numberOfLines={1} style={styles.historyValue}>
                    {item.value}
                  </Text>
                  {item.payment && (
                    <Text style={styles.historyPayment}>
                      Pago: ${item.payment.amount} {item.payment.currency}
                    </Text>
                  )}
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      <Modal visible={scanning} animationType="slide">
        <SafeAreaView style={styles.scannerContainer}>
          <View style={{ flex: 1 }}>
            {ScannerComp ? (
              <ScannerComp
                onBarCodeScanned={scanning ? onBarCodeScanned : undefined}
                style={StyleSheet.absoluteFillObject}
              />
            ) : (
              <View style={styles.centered}>
                <Text style={styles.muted}>Cargando scanner...</Text>
              </View>
            )}
          </View>
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerFrame} />
          </View>
          <View style={styles.scannerButtons}>
            <Button 
              title="Cancelar" 
              onPress={() => {
                setScanning(false);
                setScannerComp(null);
              }} 
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  const [screen, setScreen] = useState('pokemon');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topTabs}>
        <TouchableOpacity
          style={[styles.tabButton, screen === 'pokemon' && styles.tabActive]}
          onPress={() => setScreen('pokemon')}
        >
          <Text style={styles.tabText}>Pokémon</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, screen === 'qr' && styles.tabActive]}
          onPress={() => setScreen('qr')}
        >
          <Text style={styles.tabText}>QR</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, width: '100%' }}>
        {screen === 'pokemon' ? <PokemonScreen /> : <QRScreen />}
      </View>

      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  screenContainer: { flex: 1, padding: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '600' },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 8,
    borderRadius: 6,
    marginVertical: 8,
  },
  muted: { color: '#666', fontSize: 13 },
  errorText: { color: '#b00020', fontWeight: '600', marginBottom: 6 },
  listItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  itemTitle: { fontSize: 16, textTransform: 'capitalize' },
  paginationRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  pageButton: { padding: 10, backgroundColor: '#007bff', borderRadius: 6 },
  disabledButton: { backgroundColor: '#cccccc' },
  pageButtonText: { color: '#fff' },
  topTabs: { flexDirection: 'row' },
  tabButton: { flex: 1, padding: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#007bff' },
  tabText: { fontWeight: '600' },
  qrBox: { alignItems: 'center', justifyContent: 'center', padding: 16, minHeight: 180 },
  scannerContainer: { 
    flex: 1, 
    backgroundColor: '#000'
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'transparent',
  },
  scannerButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  pokemonRow: { flexDirection: 'row', alignItems: 'center' },
  pokemonSprite: { width: 80, height: 80 },
  pokemonInfo: { marginLeft: 12, flex: 1 },
  pokemonType: { color: '#666', marginTop: 4 },
  scannedModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  scannedModalBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  paymentInfo: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  historyItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  historyTimestamp: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  historyValue: {
    fontSize: 14,
  },
  historyPayment: {
    fontSize: 14,
    color: '#007bff',
    marginTop: 4,
  },
});
