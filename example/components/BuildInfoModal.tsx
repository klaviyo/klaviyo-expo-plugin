import React, { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const buildInfoFormat = require('../lib/build-info.js') as {
  buildInfoRows: (input: BuildInfoInput) => { label: string; value: string }[];
  copyText: (input: BuildInfoInput) => string;
};

interface BuildInfoInput {
  appName?: string;
  appVersion?: string;
  buildNumber?: string;
  builtAt?: string;
  commitSha?: string;
  branch?: string;
  sourceLabel?: string;
  event?: string;
  sdks?: { key: string; version?: string; ref?: string }[];
}

const APP_NAME = 'Expo Example';

// Read from the installed binary, which holds the number CI stamped into the build.
function readBuildNumber(): string | undefined {
  return Application.nativeBuildVersion ?? undefined;
}

function getBuildInfo(): BuildInfoInput {
  const extra = (Constants.expoConfig?.extra?.buildInfo ?? {}) as BuildInfoInput;
  return { ...extra, appName: APP_NAME, buildNumber: readBuildNumber() ?? extra.buildNumber };
}

// Header button for the home tab that opens the Build info modal.
export function BuildInfoButton() {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Build info"
        onPress={() => setVisible(true)}
        hitSlop={8}
        style={styles.headerButton}
        testID="build-info-button"
      >
        <Ionicons name="information-circle-outline" size={24} color="#007AFF" />
      </Pressable>
      <BuildInfoModal visible={visible} onClose={() => setVisible(false)} />
    </>
  );
}

export function BuildInfoModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const info = getBuildInfo();
  const sdkKeys = platformSdkKeys();
  const filtered = { ...info, sdks: (info.sdks ?? []).filter((sdk) => sdkKeys.includes(sdk.key)) };
  const rows = buildInfoFormat.buildInfoRows(filtered);

  const copy = async () => {
    await Clipboard.setStringAsync(buildInfoFormat.copyText(filtered));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Build info</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={styles.close}>Close</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <Text style={styles.label}>{row.label}</Text>
              <Text style={styles.value} selectable testID={`build-info-${row.label}`}>
                {row.value}
              </Text>
            </View>
          ))}
          <TouchableOpacity style={styles.copyButton} onPress={copy} testID="build-info-copy">
            <Text style={styles.copyText}>{copied ? 'Copied' : 'Copy build info'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// The wrapper SDK and the plugin are in every binary; the native SDK is the one for the running platform.
function platformSdkKeys(): string[] {
  return ['expo-plugin', 'rn', Platform.OS === 'ios' ? 'ios' : 'android'];
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  title: { fontSize: 20, fontWeight: '600', color: '#000' },
  close: { fontSize: 16, color: '#007AFF' },
  headerButton: { marginRight: 16 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  row: { marginBottom: 14 },
  label: { fontSize: 12, color: '#8E8E93', marginBottom: 4 },
  value: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    color: '#000',
    backgroundColor: '#F2F2F7',
    borderRadius: 6,
    padding: 10,
    overflow: 'hidden',
  },
  copyButton: {
    marginTop: 8,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  copyText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
