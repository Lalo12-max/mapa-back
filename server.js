const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configurar Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('🔧 Configurando Supabase...');
console.log('📍 Supabase URL:', supabaseUrl ? '✅ Configurada' : '❌ No encontrada');
console.log('🔑 Supabase Key:', supabaseKey ? '✅ Configurada' : '❌ No encontrada');

const supabase = createClient(supabaseUrl, supabaseKey);
console.log('🚀 Cliente de Supabase creado exitosamente');

// Middleware
app.use(cors());
app.use(express.json());
console.log('⚙️ Middleware configurado (CORS y JSON)');

// Función para verificar conexión con Supabase
async function testSupabaseConnection() {
  try {
    console.log('🔍 Probando conexión con Supabase...');
    const { data, error } = await supabase
      .from('packages')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.log('❌ Error al conectar con Supabase:', error.message);
    } else {
      console.log('✅ Conexión con Supabase exitosa');
      console.log('📊 Tablas accesibles');
    }
  } catch (err) {
    console.log('❌ Error de conexión:', err.message);
  }
}

// ==================== RUTAS DE SALUD ====================
app.get('/api/health', (req, res) => {
  console.log('🏥 Endpoint /api/health consultado');
  res.json({ 
    message: 'Backend funcionando correctamente', 
    supabase: !!supabase,
    timestamp: new Date().toISOString()
  });
});

// ==================== RUTAS DE AUTENTICACIÓN ====================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('🔐 Intento de login para usuario:', username);
    
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();
    
    if (error || !data) {
      console.log('❌ Login fallido para:', username);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    console.log('✅ Login exitoso para:', username, '- Rol:', data.role);
    res.json({
      user: {
        id: data.id,
        username: data.username,
        name: data.name,
        role: data.role,
        status: data.status
      }
    });
  } catch (error) {
    console.log('❌ Error en login:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== RUTAS DE REPARTIDORES ====================
app.post('/api/deliveries', async (req, res) => {
  try {
    console.log('📝 Creando nuevo repartidor:', req.body);
    const { data, error } = await supabase
      .from('usuarios')
      .insert([req.body])
      .select();
    
    if (error) {
      console.log('❌ Error creando repartidor:', error.message);
      throw error;
    }
    
    console.log('✅ Repartidor creado exitosamente:', data[0].id);
    res.status(201).json(data[0]);
  } catch (error) {
    console.log('❌ Error en POST /api/deliveries:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Busca el endpoint GET /api/deliveries y verifica que no tenga filtros
app.get('/api/deliveries', async (req, res) => {
  try {
    console.log('📋 Consultando repartidores...');
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('role', 'delivery'); 
    
    if (error) {
      console.log('❌ Error consultando repartidores:', error.message);
      return res.status(500).json({ error: error.message });
    }
    
    console.log('✅', data.length, 'repartidores encontrados');
    console.log('🔍 IDs encontrados:', data.map(d => d.id)); // Agregar este log
    res.json(data);
  } catch (error) {
    console.log('❌ Error en endpoint deliveries:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Obtener repartidores disponibles
app.get('/api/deliveries/available', async (req, res) => {
  try {
    console.log('📋 Consultando repartidores disponibles...');
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('role', 'delivery')
      .eq('status', 'available');
    
    if (error) throw error;
    console.log(`✅ ${data.length} repartidores disponibles encontrados`);
    res.json(data);
  } catch (error) {
    console.log('❌ Error en GET /api/deliveries/available:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== RUTAS DE PAQUETES ====================
app.get('/api/packages', async (req, res) => {
  try {
    console.log('📦 Consultando paquetes...');
    const { data, error } = await supabase
      .from('packages')
      .select(`
        *,
        usuarios!delivery_person_id(id, name, username)
      `);
    
    if (error) {
      console.log('❌ Error consultando paquetes:', error.message);
      throw error;
    }
    
    console.log(`✅ ${data.length} paquetes encontrados`);
    res.json(data);
  } catch (error) {
    console.log('❌ Error en GET /api/packages:', error.message);
    res.status(500).json({ error: error.message });
  }
});
// ==================== RUTAS DE CREAR UN PAQUETE ====================
app.post('/api/packages', async (req, res) => {
  try {
    console.log('📝 Creando nuevo paquete:', req.body);
    
    const packageData = {
      destinatario: req.body.destinatario,       
      direccion: req.body.direccion,              
      delivery_person_id: req.body.delivery_person_id,
      status: req.body.status || 'pending',
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const { data, error } = await supabase
      .from('packages')
      .insert([packageData])
      .select();
    
    if (error) {
      console.log('❌ Error creando paquete:', error.message);
      throw error;
    }
    
    console.log('✅ Paquete creado exitosamente:', data[0].id);
    res.status(201).json(data[0]);
  } catch (error) {
    console.log('❌ Error en POST /api/packages:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/packages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📦 Consultando paquete ID:', id);
    
    const { data, error } = await supabase
      .from('packages')
      .select(`
        *,
        usuarios!delivery_person_id(id, name, username)
      `)
      .eq('id', id)
      .single();
    
    if (error) {
      console.log('❌ Error consultando paquete:', error.message);
      throw error;
    }
    
    if (!data) {
      console.log('❌ Paquete no encontrado:', id);
      return res.status(404).json({ error: 'Paquete no encontrado' });
    }
    
    console.log('✅ Paquete encontrado:', id);
    res.json(data);
  } catch (error) {
    console.log('❌ Error en GET /api/packages/:id:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/packages/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    console.log(`📦 Actualizando estado del paquete ${id} a:`, status);
    
    const { data, error } = await supabase
      .from('packages')
      .update({ 
        status,
        updated_at: new Date()
      })
      .eq('id', id)
      .select();
    
    if (error) {
      console.log('❌ Error actualizando estado:', error.message);
      throw error;
    }
    
    console.log('✅ Estado actualizado exitosamente');
    res.json(data[0]);
  } catch (error) {
    console.log('❌ Error en PUT /api/packages/:id/status:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/packages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📝 Actualizando paquete:', id, req.body);
    
    const updateData = {
      ...req.body,
      updated_at: new Date()
    };
    
    const { data, error } = await supabase
      .from('packages')
      .update(updateData)
      .eq('id', id)
      .select();
    
    if (error) {
      console.log('❌ Error actualizando paquete:', error.message);
      throw error;
    }
    
    console.log('✅ Paquete actualizado exitosamente');
    res.json(data[0]);
  } catch (error) {
    console.log('❌ Error en PUT /api/packages/:id:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Asignar paquete a repartidor
app.put('/api/packages/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { delivery_person_id } = req.body;
    console.log(`📦 Asignando paquete ${id} al repartidor ${delivery_person_id}`);
    
    const { data, error } = await supabase
      .from('packages')
      .update({ 
        delivery_person_id,
        status: 'assigned',
        updated_at: new Date()
      })
      .eq('id', id)
      .select();
    
    if (error) throw error;
    console.log('✅ Paquete asignado exitosamente');
    res.json(data[0]);
  } catch (error) {
    console.log('❌ Error en PUT /api/packages/:id/assign:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/packages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Eliminando paquete:', id);
    
    const { error } = await supabase
      .from('packages')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.log('❌ Error eliminando paquete:', error.message);
      throw error;
    }
    
    console.log('✅ Paquete eliminado exitosamente');
    res.status(204).send();
  } catch (error) {
    console.log('❌ Error en DELETE /api/packages/:id:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== RUTAS DE UBICACIONES ====================
// Obtener última ubicación de todos los repartidores
app.get('/api/delivery-locations/latest', async (req, res) => {
  try {
    console.log('📍 Consultando últimas ubicaciones de repartidores...');
    const { data, error } = await supabase
      .from('delivery_locations')
      .select(`
        *,
        usuarios!delivery_person_id(id, name, status)
      `)
      .order('timestamp', { ascending: false });
    
    if (error) throw error;
    
    // Obtener solo la última ubicación de cada repartidor
    const latestLocations = {};
    data.forEach(location => {
      if (!latestLocations[location.delivery_person_id]) {
        latestLocations[location.delivery_person_id] = location;
      }
    });
    
    console.log(`✅ ${Object.keys(latestLocations).length} ubicaciones encontradas`);
    res.json(Object.values(latestLocations));
  } catch (error) {
    console.log('❌ Error en GET /api/delivery-locations/latest:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== RUTAS LEGACY ====================
app.get('/api/map-data', async (req, res) => {
  try {
    console.log('🗺️ Endpoint legacy /api/map-data consultado');
    const { data, error } = await supabase
      .from('packages')
      .select('*');
    
    if (error) throw error;
    
    res.json({
      message: 'Datos del mapa (legacy)',
      packages: data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.log('❌ Error en GET /api/map-data:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/locations', async (req, res) => {
  console.log('📍 Endpoint legacy /api/locations redirigiendo a /api/packages');
  res.redirect('/api/packages');
});

// ==================== CONFIGURACIÓN SOCKET.IO ====================
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:4200",
    methods: ["GET", "POST"]
  }
});

// Socket.io para ubicaciones en tiempo real
io.on('connection', (socket) => {
  console.log('🔌 Usuario conectado:', socket.id);
  
  // Unirse a sala de repartidor
  socket.on('join-delivery', (deliveryId) => {
    socket.join(`delivery-${deliveryId}`);
    console.log(`🚚 Repartidor ${deliveryId} conectado a sala`);
  });
  
  // Unirse a sala de admin
  socket.on('join-admin', () => {
    socket.join('admin');
    console.log('👨‍💼 Admin conectado a sala');
  });
  
  // Recibir ubicación del repartidor
  socket.on('location-update', async (data) => {
    try {
      const { deliveryId, latitude, longitude, accuracy, speed } = data;
      console.log(`📍 Ubicación recibida del repartidor ${deliveryId}: ${latitude}, ${longitude}`);
      
      // Guardar en base de datos usando PostGIS
      const { error } = await supabase
        .from('delivery_locations')
        .insert({
          delivery_person_id: deliveryId,
          location: `POINT(${longitude} ${latitude})`,
          accuracy: accuracy || null,
          speed: speed || null
        });
      
      if (error) {
        console.log('❌ Error guardando ubicación:', error.message);
        return;
      }
      
      console.log('✅ Ubicación guardada en BD');
      
      // Enviar a admin en tiempo real
      io.to('admin').emit('delivery-location-update', {
        deliveryId,
        latitude,
        longitude,
        timestamp: new Date(),
        accuracy,
        speed
      });
      
      console.log('📡 Ubicación enviada a admin panel');
    } catch (error) {
      console.error('❌ Error procesando ubicación:', error);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Usuario desconectado:', socket.id);
  });
});

// ==================== INICIAR SERVIDOR ====================
server.listen(port, async () => {
  console.log('🎉 ================================');
  console.log(`🚀 Servidor con Socket.io ejecutándose en http://localhost:${port}`);
  console.log('🎉 ================================');
  console.log('📋 Endpoints disponibles:');
  console.log('   🏥 GET  /api/health');
  console.log('   🔐 POST /api/auth/login');
  console.log('   🚚 GET  /api/deliveries');
  console.log('   🚚 POST /api/deliveries');
  console.log('   🚚 GET  /api/deliveries/available');
  console.log('   📦 GET  /api/packages');
  console.log('   📦 POST /api/packages');
  console.log('   📦 GET  /api/packages/:id');
  console.log('   📦 PUT  /api/packages/:id');
  console.log('   📦 PUT  /api/packages/:id/status');
  console.log('   📦 PUT  /api/packages/:id/assign');
  console.log('   📦 DELETE /api/packages/:id');
  console.log('   📍 GET  /api/delivery-locations/latest');
  console.log('   🗺️ GET  /api/map-data (legacy)');
  console.log('   📍 GET  /api/locations (legacy)');
  console.log('   🔌 Socket.io habilitado para tiempo real');
  console.log('🎉 ================================');
  
  // Probar conexión con Supabase al iniciar
  await testSupabaseConnection();
});

// Agregar después de la línea 151 (después del endpoint /api/deliveries/available)

// Para desarrollo local, permitir HTTP
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:4200');
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
  });
}

// Actualizar estado de disponibilidad del repartidor
app.put('/api/deliveries/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    console.log(`📝 Actualizando estado del repartidor ${id} a:`, status);
    
    const { data, error } = await supabase
      .from('usuarios')
      .update({ 
        status,
        updated_at: new Date() // ✅ Timestamp manejado en código
      })
      .eq('id', id)
      .eq('role', 'delivery')
      .select();
    
    if (error) {
      console.log('❌ Error actualizando estado del repartidor:', error.message);
      throw error;
    }
    
    if (data.length === 0) {
      return res.status(404).json({ error: 'Repartidor no encontrado' });
    }
    
    console.log('✅ Estado del repartidor actualizado exitosamente');
    res.json(data[0]);
  } catch (error) {
    console.log('❌ Error en PUT /api/deliveries/:id/status:', error.message);
    res.status(500).json({ error: error.message });
  }
});