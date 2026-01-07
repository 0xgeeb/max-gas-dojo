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
        <div className="absolute top-[100px] left-1/2 -translate-x-1/2 bg-black border-2 border-white text-white px-8 py-4 rounded-lg z-[1001] animate-slideDown">
            <span>{message}</span>
        </div>
    );
}
