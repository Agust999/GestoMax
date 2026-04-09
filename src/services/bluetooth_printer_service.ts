import { BleManager, Device } from "react-native-ble-plx";
import EscPosPrinter from "react-native-thermal-printer";

export interface PrinterDevice {
  id: string;
  name: string;
  connected: boolean;
}

export class BluetoothPrinterService {
  private static instance: BluetoothPrinterService;
  private connectedDevice: Device | null = null;
  private isConnected: boolean = false;

  static getInstance(): BluetoothPrinterService {
    if (!BluetoothPrinterService.instance) {
      BluetoothPrinterService.instance = new BluetoothPrinterService();
    }
    return BluetoothPrinterService.instance;
  }

  // Inicializar Bluetooth
  async initialize(): Promise<boolean> {
    try {
      await BleManager.start({ showAlert: false });
      console.log("🔵 Bluetooth inicializado");
      return true;
    } catch (error) {
      console.error("❌ Error inicializando Bluetooth:", error);
      return false;
    }
  }

  // Buscar impresoras GOOJPRT PT210
  async scanForPrinters(): Promise<PrinterDevice[]> {
    try {
      console.log("🔍 Escaneando impresoras GOOJPRT PT210...");

      // Solicitar permisos y escanear
      await BleManager.scan([], 5, true);

      return new Promise((resolve) => {
        const devices: PrinterDevice[] = [];

        const handleDiscoverPeripheral = (device: any) => {
          // Filtrar específicamente para GOOJPRT PT210
          if (
            device.name &&
            (device.name.includes("GOOJPRT") ||
              device.name.includes("PT210") ||
              device.name.includes("printer"))
          ) {
            const printer: PrinterDevice = {
              id: device.id,
              name: device.name,
              connected: false,
            };

            if (!devices.find((d) => d.id === device.id)) {
              devices.push(printer);
              console.log(`🖨️ Impresora encontrada: ${device.name}`);
            }
          }
        };

        BleManager.addListener(
          "BleManagerDiscoverPeripheral",
          handleDiscoverPeripheral,
        );

        // Detener escaneo después de 5 segundos
        setTimeout(async () => {
          await BleManager.stopScan();
          BleManager.removeListener(
            "BleManagerDiscoverPeripheral",
            handleDiscoverPeripheral,
          );
          console.log(
            `✅ Escaneo completado. ${devices.length} impresoras encontradas`,
          );
          resolve(devices);
        }, 5000);
      });
    } catch (error) {
      console.error("❌ Error escaneando impresoras:", error);
      return [];
    }
  }

  // Conectar a impresora específica
  async connectToPrinter(printerId: string): Promise<boolean> {
    try {
      console.log(`🔗 Conectando a impresora: ${printerId}`);

      await BleManager.connect(printerId);

      const device = await BleManager.retrieveServices(printerId);
      this.connectedDevice = device;
      this.isConnected = true;

      console.log("✅ Conectado a la impresora GOOJPRT PT210");
      return true;
    } catch (error) {
      console.error("❌ Error conectando a impresora:", error);
      this.isConnected = false;
      this.connectedDevice = null;
      return false;
    }
  }

  // Desconectar impresora
  async disconnect(): Promise<void> {
    try {
      if (this.connectedDevice) {
        await BleManager.disconnect(this.connectedDevice.id);
        this.connectedDevice = null;
        this.isConnected = false;
        console.log("🔌 Desconectado de la impresora");
      }
    } catch (error) {
      console.error("❌ Error desconectando impresora:", error);
    }
  }

  // Imprimir ticket
  async printTicket(ticketText: string): Promise<boolean> {
    if (!this.isConnected || !this.connectedDevice) {
      console.error("❌ No hay impresora conectada");
      return false;
    }

    try {
      console.log("🖨️ Enviando ticket a impresora GOOJPRT PT210...");

      // Configurar impresora para 58mm (ancho de papel)
      await EscPosPrinter.printInit({
        width: 58,
        language: "ESC_POS",
      });

      // Dividir el texto en líneas y enviar
      const lines = ticketText.split("\n");

      for (const line of lines) {
        // Enviar línea de texto
        await EscPosPrinter.printText({
          text: line,
          encoding: "CP437", // Codificación para caracteres especiales
          fontType: "FONT_A",
          alignment: "LEFT",
        });

        // Salto de línea
        await EscPosPrinter.printLineFeed();
      }

      // Cortar papel al final
      await EscPosPrinter.printCut();

      console.log("✅ Ticket impreso correctamente");
      return true;
    } catch (error) {
      console.error("❌ Error imprimiendo ticket:", error);
      return false;
    }
  }

  // Verificar estado de conexión
  isPrinterConnected(): boolean {
    return this.isConnected;
  }

  // Obtener dispositivo conectado
  getConnectedDevice(): Device | null {
    return this.connectedDevice;
  }
}
