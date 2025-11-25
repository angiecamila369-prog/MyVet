import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useAuth } from '../contexts/AuthContext';

type Message = {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
};

const API_KEY = 'AIzaSyDb3ur857aCX7VZ2Rt-4csxi298oWHO3NU';

type RummiModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function RummiModal({ visible, onClose }: RummiModalProps) {
  const { user, db } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('');
  const [userPets, setUserPets] = useState<any[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (visible && !initialized) {
      initializeChat();
      setInitialized(true);
    }
  }, [visible]);

  const initializeChat = async () => {
    try {
      if (!user) return;

      // Cargar perfil del usuario
      const { data: profile } = await db
        .select('profiles', 'name')
        .eq('id', user.id)
        .single();

      const name = profile?.name || user.email?.split('@')[0] || 'Usuario';
      setUserName(name);

      // Cargar mascotas del usuario
      const { data: pets } = await db
        .select('pets', '*')
        .eq('user_id', user.id);

      const petsData = pets || [];
      setUserPets(petsData);

      // Crear nueva conversación
      const { data: conversation, error: convError } = await db
        .insert('chat_conversations', [{
          user_id: user.id,
          title: 'Conversación rápida',
        }])
        .select()
        .single();

      if (convError) {
        console.error('Error creating conversation:', convError);
        return;
      }

      setConversationId(conversation.id);

      // Mensaje de bienvenida
      const welcomeMessage: Message = {
        id: 'welcome',
        text: `¡Hola ${name}! 👋 Soy Rummi. ${petsData && petsData.length > 0 ? `Veo que tienes ${petsData.length} mascota${petsData.length > 1 ? 's' : ''}: ${petsData.map((p: any) => p.name).join(', ')}. ` : ''}¿En qué puedo ayudarte hoy?`,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages([welcomeMessage]);

      // Guardar mensaje de bienvenida
      await db
        .insert('chat_messages', [{
          conversation_id: conversation.id,
          text: welcomeMessage.text,
          is_user: false,
        }]);
    } catch (error) {
      console.error('Error initializing chat:', error);
    }
  };

  const handleClose = async () => {
    // Si hay mensajes del usuario (más de solo el de bienvenida), mantener la conversación
    const hasUserMessages = messages.some(msg => msg.isUser);

    if (!hasUserMessages && conversationId) {
      // Eliminar conversación vacía
      await db
        .delete('chat_conversations')
        .eq('id', conversationId);
    }

    // Resetear estado
    setMessages([]);
    setConversationId(null);
    setInitialized(false);

    onClose();
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !conversationId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputText;
    setInputText('');
    setLoading(true);

    // Guardar mensaje del usuario
    await db
      .insert('chat_messages', [{
        conversation_id: conversationId,
        text: currentInput,
        is_user: true,
      }]);

    try {
      // Inicializar Gemini AI
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      // Crear contexto del usuario para la IA
      let contextPrompt = `Tu nombre es Rummi IA y eres un asistente virtual amigable especializado en cuidado de mascotas. NO te presentes ni saludes en cada mensaje, solo responde directamente a la pregunta. Ya te presentaste al inicio de la conversación. `;

      if (userName) {
        contextPrompt += `El usuario se llama ${userName}. `;
      }

      if (userPets.length > 0) {
        contextPrompt += `${userName || 'El usuario'} tiene ${userPets.length} mascota${userPets.length > 1 ? 's' : ''}: `;
        userPets.forEach((pet, index) => {
          contextPrompt += `${index + 1}. ${pet.name}`;
          if (pet.species) contextPrompt += ` (${pet.species}`;
          if (pet.breed) contextPrompt += `, ${pet.breed}`;
          if (pet.species) contextPrompt += `)`;
          if (pet.age) contextPrompt += `, ${pet.age} año${pet.age > 1 ? 's' : ''}`;
          if (index < userPets.length - 1) contextPrompt += `, `;
          else contextPrompt += `. `;
        });
      }

      contextPrompt += `\n\nResponde de forma directa y natural, sin saludos repetitivos.\n\nPregunta del usuario: ${currentInput}`;

      // Generar respuesta con contexto
      const result = await model.generateContent(contextPrompt);
      const response = await result.response;
      const text = response.text();

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: text,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Guardar respuesta de la IA
      await db
        .insert('chat_messages', [{
          conversation_id: conversationId,
          text: text,
          is_user: false,
        }]);

      // Actualizar título de la conversación con el primer mensaje
      if (messages.length <= 1) {
        const title = currentInput.length > 50 ? currentInput.substring(0, 50) + '...' : currentInput;
        await db
          .update('chat_conversations', { title })
          .eq('id', conversationId);
      }
    } catch (error: any) {
      console.error('Error al generar respuesta:', error);

      let errorMsg = 'Lo siento, hubo un error al procesar tu mensaje.';

      if (error.message?.includes('API_KEY_INVALID')) {
        errorMsg = 'API Key inválida. Por favor verifica tu configuración.';
      } else if (error.message?.includes('quota')) {
        errorMsg = 'Se ha excedido el límite de uso de la API. Intenta más tarde.';
      } else if (error.message?.includes('SAFETY')) {
        errorMsg = 'Tu mensaje fue bloqueado por razones de seguridad. Intenta reformularlo.';
      }

      // Mensaje de error para el usuario
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: errorMsg,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);

      Alert.alert(
        'Error',
        `No se pudo generar una respuesta. ${error.message || 'Verifica tu API Key de Google Gemini.'}`
      );
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageContainer,
        item.isUser ? styles.userMessage : styles.aiMessage,
      ]}
    >
      <Text style={styles.messageText}>{item.text}</Text>
      <Text style={styles.timestamp}>
        {item.timestamp.toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
        keyboardVerticalOffset={0}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Rummi</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={28} color="#1f2937" />
            </TouchableOpacity>
          </View>

          {/* Messages List */}
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="chat" size={64} color="#d1d5db" />
              <Text style={styles.emptyText}>Iniciando conversación...</Text>
            </View>
          ) : (
            <FlatList
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesList}
              inverted={false}
            />
          )}

          {/* Loading Indicator */}
          {loading && (
            <View style={styles.loadingContainer}>
              <View style={styles.loadingDot} />
              <View style={styles.loadingDot} />
              <View style={styles.loadingDot} />
            </View>
          )}

          {/* Input Section */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Escribe tu mensaje..."
              placeholderTextColor="#9ca3af"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                !inputText.trim() && styles.sendButtonDisabled,
              ]}
              onPress={sendMessage}
              disabled={!inputText.trim() || loading}
            >
              <MaterialIcons
                name="send"
                size={24}
                color={inputText.trim() ? '#ffffff' : '#9ca3af'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  messagesList: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#7FD0FF',
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  messageText: {
    fontSize: 16,
    color: '#1f2937',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 11,
    color: '#9ca3af',
    alignSelf: 'flex-end',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 4,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7FD0FF',
    opacity: 0.6,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    color: '#000000',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7FD0FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#f3f4f6',
  },
});
