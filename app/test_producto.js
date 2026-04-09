import { Button, Text, View } from 'react-native';
import { productoDB } from '../src/db/producto';

export default function TestProductos() {
  const addProducto = async () => {
    await productoDB.add({
      nombre: 'Pan',
      categoria: 'Alimentos',
      subcategoria: 'Panadería',
      precio_de_coste: 100,
      fecha_caducidad: new Date().toISOString(),
    });
    alert('Producto añadido');
  };

  const listar = async () => {
    const data = await productoDB.getAll();
    console.log(data);
    alert(`Productos: ${data.length}`);
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Test Productos</Text>
      <Button title="Añadir producto" onPress={addProducto} />
      <Button title="Listar productos" onPress={listar} />
    </View>
  );
}
