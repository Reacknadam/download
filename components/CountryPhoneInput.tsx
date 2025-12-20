// components/CountryPhoneInput.tsx
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface Country {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
}

// Liste des pays d'Afrique francophone
const countries: Country[] = [
  { code: 'CD', name: 'RDC', dialCode: '243', flag: '🇨🇩' },
  { code: 'CI', name: "Côte d'Ivoire", dialCode: '225', flag: '🇨🇮' },
  { code: 'SN', name: 'Sénégal', dialCode: '221', flag: '🇸🇳' },
  { code: 'CM', name: 'Cameroun', dialCode: '237', flag: '🇨🇲' },
  { code: 'BF', name: 'Burkina Faso', dialCode: '226', flag: '🇧🇫' },
  { code: 'ML', name: 'Mali', dialCode: '223', flag: '🇲🇱' },
  { code: 'GN', name: 'Guinée', dialCode: '224', flag: '🇬🇳' },
  { code: 'BJ', name: 'Bénin', dialCode: '229', flag: '🇧🇯' },
  { code: 'TG', name: 'Togo', dialCode: '228', flag: '🇹🇬' },
  { code: 'CF', name: 'RCA', dialCode: '236', flag: '🇨🇫' },
  { code: 'CG', name: 'Congo', dialCode: '242', flag: '🇨🇬' },
  { code: 'GA', name: 'Gabon', dialCode: '241', flag: '🇬🇦' },
  { code: 'NE', name: 'Niger', dialCode: '227', flag: '🇳🇪' },
  { code: 'TD', name: 'Tchad', dialCode: '235', flag: '🇹🇩' },
  { code: 'MG', name: 'Madagascar', dialCode: '261', flag: '🇲🇬' },
  { code: 'DJ', name: 'Djibouti', dialCode: '253', flag: '🇩🇯' },
  { code: 'KM', name: 'Comores', dialCode: '269', flag: '🇰🇲' },
  { code: 'RW', name: 'Rwanda', dialCode: '250', flag: '🇷🇼' },
  { code: 'BI', name: 'Burundi', dialCode: '257', flag: '🇧🇮' },
  { code: 'MU', name: 'Maurice', dialCode: '230', flag: '🇲🇺' },
  { code: 'SC', name: 'Seychelles', dialCode: '248', flag: '🇸🇨' }
]; // RDC reste en premier, les autres triés alphabétiquement

interface CountryPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const CountryPhoneInput: React.FC<CountryPhoneInputProps> = ({ 
  value, 
  onChange,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Mettre à jour le numéro de téléphone quand la valeur change
  useEffect(() => {
    if (value) {
      // Trouver le pays correspondant au préfixe
      const country = countries.find(c => value.startsWith(c.dialCode)) || countries[0];
      const number = value.replace(country.dialCode, '');
      setSelectedCountry(country);
      setPhoneNumber(number);
    }
  }, [value]);

  // Gérer le clic en dehors du menu déroulant
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    onChange(country.dialCode + phoneNumber);
    setIsOpen(false);
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Ne garder que les chiffres
    setPhoneNumber(value);
    onChange(selectedCountry.dialCode + value);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="flex rounded-xl border border-gray-300 overflow-hidden">
        {/* Sélecteur de pays */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center h-full px-4 py-3 border-r border-gray-300 bg-gray-50 hover:bg-gray-100 focus:outline-none"
          >
            <span className="text-lg mr-2">{selectedCountry.flag}</span>
            <span className="text-sm font-medium">+{selectedCountry.dialCode}</span>
            <ChevronDown className={`h-4 w-4 ml-1 text-gray-500 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
          </button>
          
          {/* Menu déroulant des pays */}
          {isOpen && (
            <div className="absolute z-[9999] mt-1 w-64 bg-white rounded-xl shadow-lg max-h-80 overflow-auto border border-gray-200">
              <div className="py-1">
                {countries.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    className={`flex items-center w-full px-4 py-2 text-sm text-left hover:bg-purple-50 ${
                      selectedCountry.code === country.code ? 'bg-purple-50 text-purple-700' : 'text-gray-700'
                    }`}
                    onClick={() => handleCountrySelect(country)}
                  >
                    <span className="text-lg w-6">{country.flag}</span>
                    <span className="ml-2 flex-1">{country.name}</span>
                    <span className="text-gray-500">+{country.dialCode}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Champ de saisie du numéro */}
        <input
          type="tel"
          value={phoneNumber}
          onChange={handlePhoneNumberChange}
          placeholder="82 123 4567"
          className="flex-1 px-4 py-3 focus:outline-none"
        />
      </div>
    </div>
  );
};