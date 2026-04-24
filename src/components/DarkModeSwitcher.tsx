import { useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { Toggle } from './ui/toggle';
import { MoonIcon, SunIcon } from 'lucide-react';

const DarkModeSwitcher = () => {
    const { colorMode, setColorMode } = useTheme();

    useEffect(() => {
        const className = 'dark';
        const bodyClass = window.document.body.classList;

        colorMode === 'dark' ? bodyClass.add(className) : bodyClass.remove(className);

        window.dispatchEvent(new CustomEvent('colorModeChange', { detail: colorMode }));
    }, [colorMode]);

    return (
        <Toggle
            className="group data-[state=on]:hover:bg-muted size-9 data-[state=on]:bg-transparent"
            pressed={colorMode === 'dark'}
            onPressedChange={() => setColorMode(colorMode === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${colorMode === 'dark' ? 'light' : 'dark'} mode`}
        >
            <MoonIcon
                size={16}
                className="shrink-0 scale-0 opacity-0 transition-all group-data-[state=on]:scale-100 group-data-[state=on]:opacity-100"
                aria-hidden="true"
            />
            <SunIcon
                size={16}
                className="absolute shrink-0 scale-100 opacity-100 transition-all group-data-[state=on]:scale-0 group-data-[state=on]:opacity-0"
                aria-hidden="true"
            />
        </Toggle>
    );
};

export default DarkModeSwitcher;
