import { useMemo, useRef, useState } from "react";
import { View, Text, Modal, StyleSheet } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import Button from "../ui/Button";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, radii, fontSizes, type Palette } from "../../theme";

// Full-screen barcode scanner. Fires onScanned once per open (the camera
// streams duplicate reads), then the parent closes the modal.
export default function BarcodeScannerSheet({
  visible,
  onScanned,
  onClose,
}: {
  visible: boolean;
  onScanned: (barcode: string) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);
  const [scanned, setScanned] = useState(false);

  const handleScan = ({ data }: { data: string }) => {
    if (scannedRef.current || !data) return;
    scannedRef.current = true;
    setScanned(true);
    onScanned(data);
  };

  const handleClose = () => {
    scannedRef.current = false;
    setScanned(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        {!permission?.granted ? (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionTitle}>Camera access</Text>
            <Text style={styles.permissionText}>
              Onyx scans barcodes to look up food nutrition. Nothing is recorded.
            </Text>
            <Button label="Allow camera" onPress={requestPermission} />
            <Button label="Cancel" variant="ghost" onPress={handleClose} />
          </View>
        ) : (
          <>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"],
              }}
              onBarcodeScanned={scanned ? undefined : handleScan}
            />
            <View style={styles.overlay}>
              <View style={styles.frame} />
              <Text style={styles.hint}>
                {scanned ? "Looking up…" : "Point at the barcode"}
              </Text>
              <Button label="Cancel" variant="secondary" onPress={handleClose} />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    camera: {
      flex: 1,
    },
    overlay: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.lg,
      padding: spacing.xl,
    },
    frame: {
      width: 260,
      height: 160,
      borderWidth: 2,
      borderColor: colors.accent,
      borderRadius: radii.md,
      backgroundColor: "transparent",
    },
    hint: {
      fontSize: fontSizes.md,
      color: colors.onFill,
      fontWeight: "600",
      textShadowColor: "rgba(0,0,0,0.6)",
      textShadowRadius: 4,
    },
    permissionBox: {
      flex: 1,
      justifyContent: "center",
      gap: spacing.md,
      padding: spacing.xl,
    },
    permissionTitle: {
      fontSize: fontSizes.xl,
      fontWeight: "700",
      color: colors.text,
    },
    permissionText: {
      fontSize: fontSizes.md,
      color: colors.muted,
    },
  });
