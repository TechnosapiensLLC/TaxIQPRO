import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../src/services/api';

import { useColors } from '../src/context/ThemeContext';
import type { Palette } from '../src/theme';
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
  deductions?: string[];
}

const QUICK_QUESTIONS = [
  'What expenses can I deduct?',
  'How do quarterly taxes work?',
  'Can I deduct my phone bill?',
  'What is the mileage rate?',
];

export default function TaxCoachScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        "Hi! I'm your AI Tax Coach. I can help you understand your taxes as a gig worker, find potential deductions, and answer any tax-related questions. What would you like to know?",
      suggestions: QUICK_QUESTIONS,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Scroll to bottom
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const response = await api.askTaxCoach(text.trim());

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response || 'I apologize, but I could not process that request.',
        suggestions: response.suggestions || [],
        deductions: response.relevant_deductions || [],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Tax coach error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content:
            'I apologize, but I encountered an error. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';

    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessage : styles.assistantMessage,
        ]}
      >
        {!isUser && (
          <View style={styles.avatarContainer}>
            <Ionicons name="sparkles" size={18} color={c.warning} />
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.assistantBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isUser && styles.userMessageText,
            ]}
          >
            {message.content}
          </Text>

          {/* Relevant Deductions */}
          {message.deductions && message.deductions.length > 0 && (
            <View style={styles.deductionsContainer}>
              <Text style={styles.deductionsTitle}>Relevant Deductions:</Text>
              {message.deductions.map((deduction, index) => (
                <View key={index} style={styles.deductionItem}>
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={c.accent}
                  />
                  <Text style={styles.deductionText}>{deduction}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Suggestions */}
          {message.suggestions && message.suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {message.suggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionChip}
                  onPress={() => sendMessage(suggestion)}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerIcon}>
            <Ionicons name="sparkles" size={20} color={c.warning} />
          </View>
          <Text style={styles.headerTitle}>AI Tax Coach</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map(renderMessage)}

          {loading && (
            <View style={styles.loadingContainer}>
              <View style={styles.avatarContainer}>
                <Ionicons name="sparkles" size={18} color={c.warning} />
              </View>
              <View style={styles.loadingBubble}>
                <ActivityIndicator size="small" color={c.warning} />
                <Text style={styles.loadingText}>Thinking...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask about taxes, deductions..."
              placeholderTextColor={c.borderStrong}
              multiline
              maxLength={500}
              editable={!loading}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!input.trim() || loading) && styles.sendButtonDisabled,
              ]}
              onPress={() => sendMessage(input)}
              disabled={!input.trim() || loading}
            >
              <Ionicons
                name="send"
                size={20}
                color={input.trim() && !loading ? '#FFF' : c.borderStrong}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.disclaimer}>
            AI assistant, not tax professional advice
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceAlt,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: c.warning + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerTitle: {
    color: c.text,
    fontSize: 18,
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  userMessage: {
    justifyContent: 'flex-end',
  },
  assistantMessage: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.warning + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: 14,
  },
  userBubble: {
    backgroundColor: c.accent,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: c.surface,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: c.text,
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: c.text,
  },
  deductionsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  deductionsTitle: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  deductionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  deductionText: {
    color: c.text,
    fontSize: 13,
    flex: 1,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: c.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
  },
  suggestionText: {
    color: c.accent,
    fontSize: 13,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 14,
    gap: 10,
  },
  loadingText: {
    color: c.textMuted,
    fontSize: 14,
  },
  inputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: c.surfaceAlt,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: c.surface,
    borderRadius: 24,
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: c.border,
  },
  input: {
    flex: 1,
    color: c.text,
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: c.border,
  },
  disclaimer: {
    color: c.borderStrong,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
  },
});
