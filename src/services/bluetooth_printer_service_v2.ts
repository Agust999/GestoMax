import { BleManager, Device } from "react-native-ble-plx";

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
      // Usar la API correcta para React Native BLE Plx
      const bleManager = new BleManager();
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

      const bleManager = new BleManager();

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

        const subscription = bleManager.on(
          "BleManagerDiscoverPeripheral",
          handleDiscoverPeripheral,
        );

        // Iniciar escaneo
        bleManager
          .start({ showAlert: false })
          .then(() => {
            // Escanear por 5 segundos
            setTimeout(async () => {
              try {
                await bleManager.stopScan();
                subscription.remove();
                console.log(
                  `✅ Escaneo completado. ${devices.length} impresoras encontradas`,
                );
                resolve(devices);
              } catch (error) {
                console.error("❌ Error deteniendo escaneo:", error);
                resolve(devices);
              }
            }, 5000);
          })
          .catch((error) => {
            console.error("❌ Error iniciando escaneo:", error);
            resolve([]);
          });

        // Iniciar escaneo de dispositivos
        bleManager.scan([], 5, true);
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

      const bleManager = new BleManager();

      await bleManager.connect(printerId);

      const peripheralInfo = await bleManager.retrieveServices(printerId);
      this.connectedDevice = peripheralInfo;
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
        const bleManager = new BleManager();
        await bleManager.disconnect(this.connectedDevice.id);
        this.connectedDevice = null;
        this.isConnected = false;
        console.log("🔌 Desconectado de la impresora");
      }
    } catch (error) {
      console.error("❌ Error desconectando impresora:", error);
    }
  }

  // Imprimir ticket (versión simplificada para GOOJPRT PT210)
  async printTicket(ticketText: string): Promise<boolean> {
    if (!this.isConnected || !this.connectedDevice) {
      console.error("❌ No hay impresora conectada");
      return false;
    }

    try {
      console.log("🖨️ Enviando ticket a impresora GOOJPRT PT210...");

      // Para GOOJPRT PT210, usamos una conexión directa y enviamos comandos ESC/POS
      const bleManager = new BleManager();

      // Convertir el texto del ticket a comandos ESC/POS
      const escPosCommands = this.convertToEscPos(ticketText);

      // Enviar comandos a la impresora vía Bluetooth
      await bleManager.writeWithoutResponse(
        this.connectedDevice.id,
        "ffe0", // UUID del servicio de impresión (varía por fabricante)
        "ffe1", // UUID de la característica de impresión
        escPosCommands,
      );

      console.log("✅ Ticket impreso correctamente");
      return true;
    } catch (error) {
      console.error("❌ Error imprimiendo ticket:", error);
      return false;
    }
  }

  // Convertir texto a comandos ESC/POS para impresora térmica
  private convertToEscPos(text: string): ArrayBuffer {
    // Comandos ESC/POS básicos
    const init = [0x1b, 0x40]; // ESC @ (inicializar)
    const alignLeft = [0x1b, 0x61, 0x00]; // ESC a 0 (alinear izquierda)
    const boldOn = [0x1b, 0x45, 0x01]; // ESC E 1 (negrita on)
    const boldOff = [0x1b, 0x45, 0x00]; // ESC E 0 (negrita off)
    const lineFeed = [0x0a]; // LF (salto de línea)
    const cutPaper = [0x1d, 0x56, 0x00]; // GS V 0 (cortar papel)

    // Convertir texto a bytes
    const textBytes = new TextEncoder().encode(text);

    // Combinar todos los comandos
    const commands = new Uint8Array([
      ...init,
      ...alignLeft,
      ...boldOn,
      ...textBytes,
      ...boldOff,
      ...lineFeed,
      ...lineFeed,
      ...cutPaper,
    ]);

    return commands.buffer;
  }

  // Verificar estado de conexión
  isPrinterConnected(): boolean {
    return this.isConnected;
  }

  // Obtener dispositivo conectado
  getConnectedDevice(): Device | null {
    return this.connectedDevice;
  }

  // Método alternativo para impresoras que no usan ESC/POS estándar
  async printTicketSimple(ticketText: string): Promise<boolean> {
    try {
      console.log("🖨️ Imprimiendo ticket en modo simple...");

      // Simular impresión exitosa para desarrollo
      // En producción, aquí iría la lógica real de Bluetooth
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log("✅ Ticket simulado correctamente");
      console.log("📄 Contenido del ticket:");
      console.log(ticketText);

      return true;
    } catch (error) {
      console.error("❌ Error en impresión simple:", error);
      return false;
    }
  }
}
