document.addEventListener('DOMContentLoaded', () => {
    // Get all necessary chatbot elements from the DOM
    const chatbotContainer = document.getElementById('chatbot-container');
    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    const chatbotCloseBtn = document.getElementById('chatbot-close-btn');
    const chatbotMessages = document.getElementById('chatbot-messages');
    const chatbotForm = document.getElementById('chatbot-form');
    const chatbotInput = document.getElementById('chatbot-input');
    const searchScopeToggle = document.getElementById('search-scope-toggle');
    const pageContinent = document.body.dataset.continent || null;
    const scopeGlobal = document.getElementById('scope-global');
    const scopePage = document.getElementById('scope-page');

    // --- Event Listeners ---

    // Toggle the chatbot window visibility
    chatToggleBtn.addEventListener('click', () => {
        chatbotContainer.classList.toggle('show-chatbot');
        if (chatbotContainer.classList.contains('show-chatbot') && chatbotMessages.children.length === 0) {
            addMessage({ reply: "Hello! I'm your news assistant. How can I help you find information today?" }, 'bot');
        }
    });

    // Close the chatbot window
    chatbotCloseBtn.addEventListener('click', () => {
        chatbotContainer.classList.remove('show-chatbot');
    });

    // Handle form submission when a user sends a message
    chatbotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = chatbotInput.value.trim();

        if (message) {
            addMessage({ reply: message }, 'user');
            chatbotInput.value = '';

            addMessage({ reply: '...' }, 'bot', true);

            const searchScope = searchScopeToggle.checked ? 'page' : 'global';
            const finalContinent = searchScope === 'page' ? pageContinent : null;

            try {
                const response = await fetch('/api/chatbot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message, continent: finalContinent }),
                });

                const data = await response.json();
                
                removeTypingIndicator();

                if (data.results && data.results.length > 0) {
                    const headerMessage = data.results.length > 1 ? `I found ${data.results.length} relevant articles:` : `I found 1 relevant article:`;
                    addMessage({ reply: headerMessage }, 'bot');

                    data.results.forEach(result => {
                        addMessage(result, 'bot', false, message);
                    });
                } else {
                    addMessage(data, 'bot', false, message);
                }

            } catch (error) {
                console.error('Error with chatbot:', error);
                removeTypingIndicator();
                addMessage({ reply: "Sorry, I'm having trouble connecting right now. Please try again later." }, 'bot');
            }
        }
    });
    
    function updateToggleLabels() {
        if (searchScopeToggle.checked) {
            scopePage.classList.add('active');
            scopeGlobal.classList.remove('active');
        } else {
            scopeGlobal.classList.add('active');
            scopePage.classList.remove('active');
        }
    }

    searchScopeToggle.addEventListener('change', updateToggleLabels);

    // --- Helper Functions ---

    function highlightKeywords(text, query) {
        if (!text) return '';
        if (!query) return text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>');

        const keywords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
        if (keywords.length === 0) return text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>');

        const sanitizedText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        
        const regex = new RegExp(`(${keywords.join('|')})`, 'gi');
        return sanitizedText.replace(regex, '<b>$1</b>').replace(/\n/g, '<br>');
    }

    function addMessage(data, sender, isTyping = false, originalQuery = '') {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', `${sender}-message`);
        
        if (isTyping) {
            messageElement.classList.add('typing-indicator');
            messageElement.textContent = data.reply;
        } else if (sender === 'bot') {
            if (data.heading) {
                const headingElement = document.createElement('strong');
                headingElement.classList.add('chat-heading');
                headingElement.innerHTML = highlightKeywords(data.heading, originalQuery);
                messageElement.appendChild(headingElement);
            }

            const replyText = document.createElement('p');
            replyText.innerHTML = highlightKeywords(data.reply, originalQuery);
            messageElement.appendChild(replyText);

            if (data.source || data.category || data.pageName) {
                const metaDiv = document.createElement('div');
                metaDiv.classList.add('chat-meta');
                
                let metaInfo = [];
                if (data.pageName) metaInfo.push(`Page: ${data.pageName}`);
                if (data.category) metaInfo.push(`Category: ${data.category}`);
                if (data.source) metaInfo.push(`Source: ${data.source}`);
                
                metaDiv.textContent = metaInfo.join(' | ');
                messageElement.appendChild(metaDiv);
            }
        } else {
            messageElement.textContent = data.reply;
        }
        
        chatbotMessages.appendChild(messageElement);
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    }
    
    function removeTypingIndicator() {
        const typingIndicator = chatbotMessages.querySelector('.typing-indicator');
        if (typingIndicator) {
            chatbotMessages.removeChild(typingIndicator);
        }
    }
    
    updateToggleLabels();
});
