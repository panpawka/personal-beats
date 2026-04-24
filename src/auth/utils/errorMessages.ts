const errorTranslations: Record<string, string> = {
    'Invalid credentials': 'Nieprawidłowy e-mail lub hasło',
    'Invalid credentials.': 'Nieprawidłowy e-mail lub hasło',
    'User with this email already exists': 'Użytkownik z tym e-mailem już istnieje',
    'Email is not verified': 'E-mail nie został zweryfikowany',
    'Invalid token': 'Nieprawidłowy lub wygasły token',
    'Token not found in URL': 'Brak tokenu weryfikacyjnego w linku',

    'Password must be at least 8 characters': 'Hasło musi mieć co najmniej 8 znaków',
    'Password must be at least 8 characters long': 'Hasło musi mieć co najmniej 8 znaków',
    'Passwords do not match': 'Hasła nie są identyczne',

    'Invalid email format': 'Nieprawidłowy format e-mail',
    'Email is required': 'E-mail jest wymagany',
    'Password is required': 'Hasło jest wymagane',

    'Network error': 'Błąd połączenia. Sprawdź połączenie z internetem.',
    'Failed to fetch': 'Błąd połączenia. Sprawdź połączenie z internetem.',
};

export function translateAuthError(error: Error | string): string {
    const errorMessage = typeof error === 'string' ? error : error.message;

    if (errorTranslations[errorMessage]) {
        return errorTranslations[errorMessage];
    }

    const lowerMessage = errorMessage.toLowerCase();
    for (const [key, value] of Object.entries(errorTranslations)) {
        if (lowerMessage.includes(key.toLowerCase())) {
            return value;
        }
    }

    return errorMessage;
}
