import React, { useState, useEffect } from 'react';
import { PlusCircle, Lightbulb, Trophy, BookOpen, Brain, Search, Filter, Trash2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Replace with your actual Supabase credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ffyuwiwsyirtmlbnozpz.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmeXV3aXdzeWlydG1sYm5venB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MzI5NDQsImV4cCI6MjA2NDEwODk0NH0.YZwIJhTi5YUaM22_u6HYbl7Y3QTdo09hOFwoDHQCSms';

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Gemini
const genAI = import.meta.env.VITE_GEMINI_API_KEY ? 
  new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY) : null;

const AIJournal = () => {
  const [entries, setEntries] = useState([]);
  const [newEntry, setNewEntry] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .order('timestamp', { ascending: false });
      
      if (error) {
        console.error('Error loading entries:', error);
      } else {
        setEntries(data || []);
      }
    } catch (error) {
      console.error('Error loading entries:', error);
    } finally {
      setLoading(false);
    }
  };

  // Keyword-based fallback categorization
  const keywordCategorize = (text) => {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('achieved') || lowerText.includes('completed') || lowerText.includes('success') || 
        lowerText.includes('won') || lowerText.includes('accomplished') || lowerText.includes('milestone') ||
        lowerText.includes('breakthrough') || lowerText.includes('victory') || lowerText.includes('finished') ||
        lowerText.includes('built') || lowerText.includes('deployed') || lowerText.includes('did it') ||
        lowerText.includes('done') || lowerText.includes('solved')) {
      return 'win';
    }
    
    if (lowerText.includes('idea') || lowerText.includes('concept') || lowerText.includes('what if') || 
        lowerText.includes('maybe') || lowerText.includes('could') || lowerText.includes('innovation') ||
        lowerText.includes('brainstorm') || lowerText.includes('thinking') || lowerText.includes('possibility')) {
      return 'idea';
    }
    
    if (lowerText.includes('learned') || lowerText.includes('discovered') || lowerText.includes('realized') || 
        lowerText.includes('insight') || lowerText.includes('understanding') || lowerText.includes('knowledge') ||
        lowerText.includes('found out') || lowerText.includes('research') || lowerText.includes('studied')) {
      return 'learning';
    }
    
    return 'reflection';
  };

  // AI-powered categorization
  const categorizeEntry = async (text) => {
    const isLocal = window.location.hostname === 'localhost';
    
    try {
      if (isLocal) {
        // Use Ollama for local categorization
        const response = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3.2:3b',
            prompt: `Categorize this journal entry into exactly one of these categories: "win", "idea", "learning", or "reflection"

Entry: "${text}"

Rules:
- "win" = achievements, accomplishments, completions, successes, breakthroughs, finishing projects, solving problems, deployments
- "idea" = concepts, brainstorms, possibilities, innovations, "what if" thoughts, creative suggestions
- "learning" = insights, discoveries, knowledge gained, understanding, research findings, lessons learned
- "reflection" = general thoughts, observations, feelings, contemplations, philosophical musings

Examples:
- "We built this app!" = win
- "I deployed the project successfully" = win
- "What if we used AI for categorization?" = idea
- "I learned how to use React hooks" = learning
- "Today was interesting" = reflection

Respond with ONLY the category name (win/idea/learning/reflection), nothing else.`,
            stream: false,
            options: {
              temperature: 0.1,
              max_tokens: 10
            }
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          const category = data.response?.trim().toLowerCase();
          if (['win', 'idea', 'learning', 'reflection'].includes(category)) {
            return category;
          }
        }
      } else if (genAI) {
        // Use Gemini for cloud categorization
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(`Categorize this journal entry into exactly one of these categories: "win", "idea", "learning", or "reflection"

Entry: "${text}"

Rules:
- "win" = achievements, accomplishments, completions, successes, breakthroughs, finishing projects, solving problems, deployments
- "idea" = concepts, brainstorms, possibilities, innovations, "what if" thoughts, creative suggestions  
- "learning" = insights, discoveries, knowledge gained, understanding, research findings, lessons learned
- "reflection" = general thoughts, observations, feelings, contemplations, philosophical musings

Examples:
- "We built this app!" = win
- "I deployed the project successfully" = win
- "What if we used AI for categorization?" = idea
- "I learned how to use React hooks" = learning
- "Today was interesting" = reflection

Respond with ONLY the category name (win/idea/learning/reflection), nothing else.`);
        
        const category = result.response.text()?.trim().toLowerCase();
        if (['win', 'idea', 'learning', 'reflection'].includes(category)) {
          return category;
        }
      }
    } catch (error) {
      console.error('AI categorization failed:', error);
    }
    
    // Fallback to keyword matching
    console.log('Using fallback categorization for:', text);
    return keywordCategorize(text);
  };

  // Real AI responses using Llama (local) vs Gemini (cloud)
  const generateAIResponse = async (entry, category) => {
    const isLocal = window.location.hostname === 'localhost';
    
    if (isLocal) {
      return await generateOllamaResponse(entry, category);
    } else {
      return await generateGeminiResponse(entry, category);
    }
  };

  const generateOllamaResponse = async (entry, category) => {
    try {
      const prompt = `You are an intelligent journal companion. A user just wrote this ${category} entry: "${entry}"

Please provide a thoughtful, encouraging response that:
- Acknowledges their ${category}
- Asks 1-2 insightful follow-up questions
- Offers practical suggestions or perspectives
- Keeps it conversational and supportive
- Limit response to 2-3 sentences

Respond as a helpful friend, not a therapist.`;

      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3.2:3b',
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            max_tokens: 150
          }
        })
      });

      if (!response.ok) {
        throw new Error('Ollama request failed');
      }

      const data = await response.json();
      return data.response || getFallbackResponse(category);
      
    } catch (error) {
      console.error('Ollama error:', error);
      return getFallbackResponse(category);
    }
  };

  const generateGeminiResponse = async (entry, category) => {
    try {
      if (!genAI) {
        return getFallbackResponse(category);
      }

      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `You are an intelligent journal companion. A user just wrote this ${category} entry: "${entry}"

Please provide a thoughtful, encouraging response that:
- Acknowledges their ${category}
- Asks 1-2 insightful follow-up questions
- Offers practical suggestions or perspectives
- Keeps it conversational and supportive
- Limit response to 2-3 sentences

Respond as a helpful friend, not a therapist.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text() || getFallbackResponse(category);
      
    } catch (error) {
      console.error('Gemini error:', error);
      return getFallbackResponse(category);
    }
  };

  // Fallback responses if AI is unavailable
  const getFallbackResponse = (category) => {
    const fallbackResponses = {
      win: [
        "🎉 Congratulations! This achievement shows your dedication paying off. What made this success possible?",
        "🌟 Fantastic milestone! How can you build on this momentum?",
        "🏆 Well done! What doors might this achievement open for you?",
        "💪 Great work! What's the next challenge you want to tackle?"
      ],
      idea: [
        "💡 Intriguing concept! What would the first small step to test this idea look like?",
        "🧠 Creative thinking! Who else might benefit from this idea?",
        "✨ Interesting angle! What resources would you need to explore this further?",
        "🚀 Compelling idea! Have you considered potential obstacles?"
      ],
      learning: [
        "📚 Valuable insight! How does this connect to your existing understanding?",
        "🔍 Great discovery! What questions does this learning raise for you?",
        "🌱 Knowledge growth! How might you apply this learning practically?",
        "💭 Thoughtful reflection! What would you want to learn next in this area?"
      ],
      reflection: [
        "🤔 Thoughtful observation! What patterns do you notice in your thinking?",
        "💭 Interesting perspective! How has your viewpoint evolved over time?",
        "🎯 Valuable reflection! What actions might this insight inspire?",
        "🔄 Good introspection! What would you tell someone else in a similar situation?"
      ]
    };
    
    const categoryResponses = fallbackResponses[category];
    return categoryResponses[Math.floor(Math.random() * categoryResponses.length)];
  };

  const addEntry = async () => {
    if (!newEntry.trim()) return;
    
    setIsGenerating(true);
    setAiResponse("🤖 Thinking...");
    
    try {
      // Get AI categorization
      const category = await categorizeEntry(newEntry);
      console.log('AI categorized as:', category);
      
      // Get AI response
      const response = await generateAIResponse(newEntry, category);
      
      const entry = {
        text: newEntry,
        category,
        timestamp: new Date().toISOString(),
        ai_response: response
      };
        
      const { data, error } = await supabase
        .from('journal_entries')
        .insert([entry])
        .select();
      
      if (error) {
        console.error('Error adding entry:', error);
      } else {
        setEntries(prev => [data[0], ...prev]);
        setNewEntry('');
        setAiResponse(response);
        
        // Clear AI response after 8 seconds
        setTimeout(() => setAiResponse(''), 8000);
      }
    } catch (error) {
      console.error('Error adding entry:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteEntry = async (id) => {
    try {
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting entry:', error);
      } else {
        setEntries(prev => prev.filter(entry => entry.id !== id));
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  const filteredEntries = entries.filter(entry => {
    const matchesFilter = filter === 'all' || entry.category === filter;
    const matchesSearch = entry.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         entry.ai_response.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'win': return <Trophy className="w-4 h-4 text-yellow-500" />;
      case 'idea': return <Lightbulb className="w-4 h-4 text-blue-500" />;
      case 'learning': return <BookOpen className="w-4 h-4 text-green-500" />;
      default: return <Brain className="w-4 h-4 text-purple-500" />;
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'win': return 'border-l-yellow-500 bg-yellow-50';
      case 'idea': return 'border-l-blue-500 bg-blue-50';
      case 'learning': return 'border-l-green-500 bg-green-50';
      default: return 'border-l-purple-500 bg-purple-50';
    }
  };

  const stats = {
    total: entries.length,
    wins: entries.filter(e => e.category === 'win').length,
    ideas: entries.filter(e => e.category === 'idea').length,
    learning: entries.filter(e => e.category === 'learning').length,
    reflections: entries.filter(e => e.category === 'reflection').length
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">AI Journal & Idea Tracker</h1>
        <p className="text-gray-600">Your intelligent companion for capturing thoughts, ideas, and achievements</p>
        <div className="mt-2 text-sm text-gray-500">
          {isGenerating ? "🤖 AI is thinking..." : "Powered by Ollama (Llama3.2:3b) & Gemini 1.5 Flash with AI Categorization"}
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Entries</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-yellow-600">{stats.wins}</div>
          <div className="text-sm text-gray-600">Wins</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-blue-600">{stats.ideas}</div>
          <div className="text-sm text-gray-600">Ideas</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-green-600">{stats.learning}</div>
          <div className="text-sm text-gray-600">Learning</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="text-2xl font-bold text-purple-600">{stats.reflections}</div>
          <div className="text-sm text-gray-600">Reflections</div>
        </div>
      </div>

      {/* AI Response Display */}
      {aiResponse && (
        <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <Brain className={`w-5 h-5 text-indigo-600 mt-0.5 ${isGenerating ? 'animate-pulse' : ''}`} />
            <div>
              <div className="text-sm font-medium text-indigo-900 mb-1">
                {isGenerating ? "AI is thinking..." : "AI Response"}
              </div>
              <div className="text-indigo-800">{aiResponse}</div>
            </div>
          </div>
        </div>
      )}

      {/* Entry Input */}
      <div className="mb-6 bg-white rounded-lg shadow-sm border p-4">
        <div className="flex space-x-3">
          <textarea
            value={newEntry}
            onChange={(e) => setNewEntry(e.target.value)}
            placeholder="Share your thoughts, ideas, wins, or learnings... The AI will automatically categorize and respond!"
            className="flex-1 p-3 border rounded-lg resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            rows="3"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                addEntry();
              }
            }}
          />
          <button
            onClick={addEntry}
            disabled={!newEntry.trim() || isGenerating}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <PlusCircle className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Thinking...' : 'Add'}</span>
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Tip: Press Cmd/Ctrl + Enter to quick-add | AI-powered categorization
        </div>
      </div>

      {/* Filters and Search */}
      <div className="mb-6 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Categories</option>
            <option value="win">🏆 Wins</option>
            <option value="idea">💡 Ideas</option>
            <option value="learning">📚 Learning</option>
            <option value="reflection">🤔 Reflections</option>
          </select>
        </div>
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search entries..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Entries List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-pulse" />
            <p>Loading your journal entries...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {entries.length === 0 ? (
              <div>
                <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p>Start your AI-powered journaling journey!</p>
                <p className="text-sm mt-2">Your entries will be automatically categorized and you'll receive intelligent responses.</p>
              </div>
            ) : (
              <p>No entries match your current filters.</p>
            )}
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className={`bg-white border-l-4 rounded-lg shadow-sm p-4 ${getCategoryColor(entry.category)}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {getCategoryIcon(entry.category)}
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {entry.category}
                  </span>
                  <span className="text-sm text-gray-500">
                    {new Date(entry.timestamp).toLocaleDateString()} at {new Date(entry.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                <button
                  onClick={() => deleteEntry(entry.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <div className="mb-3">
                <p className="text-gray-800">{entry.text}</p>
              </div>
              
              <div className="bg-white bg-opacity-70 rounded-lg p-3 border border-gray-200">
                <div className="flex items-start space-x-2">
                  {window.location.hostname === 'localhost' ? 
                    <span className="text-lg">🦙</span> : 
                    <span className="text-lg">💎</span>
                  }
                  <div>
                    <div className="text-xs font-medium text-indigo-900 mb-1">
                      {window.location.hostname === 'localhost' ? 'Llama Response' : 'Gemini Response'}
                    </div>
                    <p className="text-sm text-indigo-800">{entry.ai_response}</p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AIJournal;
