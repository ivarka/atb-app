import { DeparturesScreen } from './src/screens/DeparturesScreen';
import { Departure, Place } from './src/domain/types';
import React, { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTravel } from './src/state/useTravel';
import { PlanningScreen } from './src/screens/PlanningScreen';
import { ActiveScreen } from './src/screens/ActiveScreen';
import { colors } from './src/ui/theme';

export default function App() {
  return <SafeAreaProvider><SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}><StatusBar style="dark" /><TravelApp /></SafeAreaView></SafeAreaProvider>;
}
function TravelApp() {
  const travel = useTravel();
  const [screen, setScreen] = useState<'planning' | 'active' | 'departures'>(travel.active ? 'active' : 'planning');
  const [departureOptions, setDepartureOptions] = useState<{ alreadyOnboard: boolean; initialDeparture?: Departure; initialPlace?: Place }>({alreadyOnboard:false});
  const openDepartures = (alreadyOnboard: boolean, initialDeparture?: Departure, initialPlace?: Place) => { setDepartureOptions({alreadyOnboard,initialDeparture,initialPlace}); setScreen('departures'); };
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'departures') { setScreen(travel.active ? 'active' : 'planning'); return true; }
      if (screen === 'active') { setScreen('planning'); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [screen, !!travel.active]);
  if (screen === 'departures') return <DeparturesScreen travel={travel} {...departureOptions} onBack={() => setScreen(travel.active ? 'active' : 'planning')} onOpenActive={() => setScreen('active')} />;
  return screen === 'active' && travel.active
    ? <ActiveScreen travel={travel} onDepartures={openDepartures} onBack={() => setScreen('planning')} />
    : <PlanningScreen onDepartures={openDepartures} key={travel.restartKey} travel={travel} onOpenActive={() => setScreen('active')} />;
}
