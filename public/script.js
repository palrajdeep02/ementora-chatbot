document.addEventListener('DOMContentLoaded', () => {
    const chatLog = document.getElementById('chat-log');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const typingIndicator = document.getElementById('typing-indicator');

    const createMessageElement = (message, sender) => {
        const isUser = sender === 'user';
        const messageClass = isUser ? 'user-message' : 'bot-message';
        const avatarClass = isUser ? 'user-avatar' : 'bot-avatar';
        const avatarIcon = isUser ? 'fa-user' : 'fa-robot';

        const messageDiv = document.createElement('div');
        messageDiv.className = messageClass;

        const avatarDiv = document.createElement('div');
        avatarDiv.className = avatarClass;
        avatarDiv.innerHTML = `<i class="fa-solid ${avatarIcon}"></i>`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        const p = document.createElement('p');
        p.textContent = message; // Use textContent for security
        contentDiv.appendChild(p);
        
        if (isUser) {
            messageDiv.appendChild(contentDiv);
            messageDiv.appendChild(avatarDiv);
        } else {
            messageDiv.appendChild(avatarDiv);
            messageDiv.appendChild(contentDiv);
        }
        
        return messageDiv;
    };
    
    // CORRECTED: This function is now only responsible for adding messages.
    const addMessageToLog = (message, sender) => {
        const messageElement = createMessageElement(message, sender);
        chatLog.appendChild(messageElement);
        scrollToBottom();
    };

    const scrollToBottom = () => {
        chatLog.scrollTop = chatLog.scrollHeight;
    };

    // CORRECTED: This function now handles both adding AND removing the indicator.
    const toggleLoadingState = (isLoading) => {
        userInput.disabled = isLoading;
        sendBtn.disabled = isLoading;

        if (isLoading) {
            // Add the indicator to the bottom of the chat log
            chatLog.appendChild(typingIndicator);
            typingIndicator.style.display = 'flex';
            scrollToBottom();
        } else {
            // Remove the indicator from the chat log if it exists
            if (chatLog.contains(typingIndicator)) {
                chatLog.removeChild(typingIndicator);
            }
        }
    };

    const handleSend = async () => {
        const message = userInput.value.trim();
        if (!message) return;

        addMessageToLog(message, 'user');
        userInput.value = '';
        toggleLoadingState(true);

        try {
            const res = await fetch("/api/chatbot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message }),
            });

            if (!res.ok) throw new Error(`Server error: ${res.status}`);

            const data = await res.json();
            addMessageToLog(data.reply, 'bot');

        } catch (error) {
            console.error("Failed to send message:", error);
            const errorElement = createMessageElement("Sorry, I'm having trouble connecting. Please try again later.", 'bot');
            errorElement.classList.add('error-message');
            chatLog.appendChild(errorElement);
            scrollToBottom();
        } finally {
            toggleLoadingState(false);
        }
    };

    sendBtn.addEventListener('click', handleSend);
    userInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            handleSend();
        }
    });
});