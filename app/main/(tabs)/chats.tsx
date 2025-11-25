import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

type Message = {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
};


const API_KEY = 'AIzaSyDb3ur857aCX7VZ2Rt-4csxi298oWHO3NU';

export default function AIChat() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, db } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('');
  const [userPets, setUserPets] = useState<any[]>([]);
  const [contextLoaded, setContextLoaded] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [hasUserMessages, setHasUserMessages] = useState(false);

  // Refs para mantener valores actualizados en el cleanup
  const hasUserMessagesRef = useRef(false);
  const conversationIdRef = useRef<string | null>(null);

  // Actualizar refs cuando cambien los valores
  useEffect(() => {
    hasUserMessagesRef.current = hasUserMessages;
  }, [hasUserMessages]);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // Cargar información del usuario y mascotas (solo una vez al inicio)
  useEffect(() => {
    const loadUserContext = async () => {
      try {
        if (!user) return;

        // Cargar perfil del usuario
        const { data: profile } = await db
          .select('profiles', 'name')
          .eq('id', user.id)
          .single();

        if (profile) {
          setUserName(profile.name || user.email?.split('@')[0] || 'Usuario');
        }

        // Cargar mascotas del usuario
        const { data: pets } = await db
          .select('pets', '*')
          .eq('user_id', user.id);

        if (pets) {
          setUserPets(pets);
        }

        setContextLoaded(true);
      } catch (error) {
        console.error('Error loading user context:', error);
      }
    };

    loadUserContext();
  }, []); // Solo se ejecuta al montar el componente

  // Crear conversación cuando se gana el foco (cambio de tab)
  useFocusEffect(
    useCallback(() => {
      console.log('Chat focused');

      const initConversation = async () => {
        // Si hay un conversationId en los parámetros, cargar esa conversación
        if (params.conversationId && typeof params.conversationId === 'string') {
          console.log('Loading existing conversation:', params.conversationId);
          await loadExistingConversation(params.conversationId);
        } else if (user && userName && contextLoaded) {
          // Si no hay conversationId, crear una nueva
          console.log('Creating new conversation');
          await createNewConversation(user.id, userName, userPets);
        }
      };

      initConversation();

      // Cleanup cuando se pierde el foco
      return () => {
        console.log('Chat unfocused - cleaning up');
        // Siempre limpiar el estado local
        setMessages([]);
        setConversationId(null);
        setHasUserMessages(false);

        // Solo eliminar conversaciones vacías si no es del historial
        if (!params.conversationId) {
          const currentHasUserMessages = hasUserMessagesRef.current;
          const currentConversationId = conversationIdRef.current;

          if (!currentHasUserMessages && currentConversationId) {
            console.log('Deleting empty conversation:', currentConversationId);
            db
              .delete('chat_conversations')
              .eq('id', currentConversationId)
              .then((result: any) => {
                if (result.error) {
                  console.error('Error deleting conversation:', result.error);
                } else {
                  console.log('Empty conversation deleted');
                }
              });
          }
        }

        // Resetear refs
        hasUserMessagesRef.current = false;
        conversationIdRef.current = null;
      };
    }, [user, userName, userPets, contextLoaded, params.conversationId])
  );

  const loadExistingConversation = async (convId: string) => {
    try {
      // Cargar mensajes de la conversación
      const { data: messagesData, error: messagesError } = await db
        .select('chat_messages', '*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('Error loading messages:', messagesError);
        return;
      }

      // Convertir mensajes al formato del componente
      const loadedMessages: Message[] = messagesData.map((msg: any) => ({
        id: msg.id,
        text: msg.text,
        isUser: msg.is_user,
        timestamp: new Date(msg.created_at),
      }));

      setMessages(loadedMessages);
      setConversationId(convId);
      setHasUserMessages(true); // La conversación ya existe, así que tiene mensajes del usuario
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const createNewConversation = async (uid: string, name: string, pets: any[]) => {
    try {
      // Crear nueva conversación
      const { data: conversation, error: convError } = await db
        .insert('chat_conversations', [{
          user_id: uid,
          title: 'Nueva conversación',
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
        text: `¡Hola ${name}! 👋 Soy Rummi. ${pets && pets.length > 0 ? `Veo que tienes ${pets.length} mascota${pets.length > 1 ? 's' : ''}: ${pets.map((p: any) => p.name).join(', ')}. ` : ''}¿En qué puedo ayudarte hoy?`,
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
      console.error('Error creating conversation:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !conversationId) return;

    // Mark that user has sent at least one message
    setHasUserMessages(true);

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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={28} color="#1f2937" />
        </TouchableOpacity>
        <Image
          source={require('../../../assets/images/Rummi.jpg')}
          style={styles.rummiImage}
        />
        <Text style={styles.headerTitle}>Rummi</Text>
        <TouchableOpacity
          onPress={() => router.push('../../conversations-list' as any)}
          style={styles.historyButton}
        >
          <MaterialIcons name="history" size={28} color="#1f2937" />
        </TouchableOpacity>
      </View>

      {/* Messages List */}
      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="chat" size={64} color="#d1d5db" />
          <Text style={styles.emptyText}>Start a conversation</Text>
          <Text style={styles.emptySubtext}>
            Ask me anything and I'll do my best to help!
          </Text>
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type your message..."
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
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D4F3FF',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  historyButton: {
    padding: 4,
  },
  rummiImage: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#f8fafc',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
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
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    color: '#1f2937',
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
