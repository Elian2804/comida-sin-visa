// routes/reservas.js
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Crear nueva reserva
router.post('/', async (req, res) => {
  try {
    const {
      nombre_completo, telefono, email, numero_comensales,
      fecha_reserva, pais_experiencia, ocasion_especial
    } = req.body;
    
    // Validaciones básicas
    if (!nombre_completo || !telefono || !email || !numero_comensales || !fecha_reserva) {
      return res.status(400).json({ 
        error: 'Faltan campos obligatorios',
        campos_requeridos: ['nombre_completo', 'telefono', 'email', 'numero_comensales', 'fecha_reserva']
      });
    }
    
    // Verificar que la fecha no sea en el pasado
    const fechaReserva = new Date(fecha_reserva);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    if (fechaReserva < hoy) {
      return res.status(400).json({ 
        error: 'La fecha de reserva no puede ser en el pasado' 
      });
    }
    
    // Verificar número de comensales válido
    const comensales = parseInt(numero_comensales);
    if (comensales < 1 || comensales > 12) {
      return res.status(400).json({ 
        error: 'El número de comensales debe estar entre 1 y 12' 
      });
    }
    
    const { data, error } = await supabase
      .from('reservas')
      .insert({
        nombre_completo,
        telefono,
        email,
        numero_comensales: comensales,
        fecha_reserva,
        pais_experiencia,
        ocasion_especial,
        estado: 'pendiente'
      })
      .select();
    
    if (error) throw error;
    
    res.status(201).json({
      success: true,
      message: 'Reserva creada exitosamente. Nos pondremos en contacto contigo pronto.',
      reserva: data[0]
    });
  } catch (error) {
    console.error('Error al crear reserva:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
});

// Obtener reservas (solo para administración)
router.get('/', async (req, res) => {
  try {
    const { estado, fecha_desde, fecha_hasta } = req.query;
    
    let query = supabase
      .from('reservas')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (estado) {
      query = query.eq('estado', estado);
    }
    
    if (fecha_desde) {
      query = query.gte('fecha_reserva', fecha_desde);
    }
    
    if (fecha_hasta) {
      query = query.lte('fecha_reserva', fecha_hasta);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    res.json({
      reservas: data,
      total: data.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Suscribir al newsletter
router.post('/newsletter', async (req, res) => {
  try {
    const { email, nombre } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        error: 'Email es requerido' 
      });
    }
    
    // Validar formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Formato de email inválido' 
      });
    }
    
    const { data, error } = await supabase
      .from('suscriptores')
      .upsert(
        { email, nombre, activo: true }, 
        { onConflict: 'email' }
      )
      .select();
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: 'Suscripción exitosa al newsletter',
      suscriptor: data[0]
    });
  } catch (error) {
    console.error('Error en suscripción:', error);
    res.status(500).json({ 
      error: 'Error al procesar suscripción',
      message: error.message 
    });
  }
});

// Verificar disponibilidad de fecha
router.get('/disponibilidad/:fecha', async (req, res) => {
  try {
    const { fecha } = req.params;
    
    // Verificar que la fecha no sea en el pasado
    const fechaConsulta = new Date(fecha);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    if (fechaConsulta < hoy) {
      return res.json({ 
        disponible: false, 
        mensaje: 'Fecha no disponible (pasada)' 
      });
    }
    
    const { data, error } = await supabase
      .from('reservas')
      .select('numero_comensales')
      .eq('fecha_reserva', fecha)
      .in('estado', ['pendiente', 'confirmada']);
    
    if (error) throw error;
    
    const totalComensales = data.reduce((sum, reserva) => sum + reserva.numero_comensales, 0);
    const capacidadMaxima = 50; // Capacidad máxima del restaurante
    
    res.json({
      disponible: totalComensales < capacidadMaxima,
      espacios_ocupados: totalComensales,
      espacios_disponibles: capacidadMaxima - totalComensales,
      mensaje: totalComensales < capacidadMaxima ? 'Fecha disponible' : 'Fecha completa'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;