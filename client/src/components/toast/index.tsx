import { useState, useEffect } from 'react';

export const Toast = ({ message, duration = 3000, onClose }) => {
    const [visible, setVisible] = useState(!!message);

    useEffect(() => {
        if (message) {
            setVisible(true);
            const timer = setTimeout(() => {
                setVisible(false);
                if (onClose) onClose();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [message, duration, onClose]);

    if (!visible || !message) return null;

    return (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm border border-gray-200 text-gray-900 px-8 py-4 rounded-xl shadow-lg z-[1001] animate-slideDown">
            <span className="font-medium">{message}</span>
        </div>
    );
}
