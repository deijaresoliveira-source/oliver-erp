ALTER TABLE empresas
ADD COLUMN sistema_tipo VARCHAR(30) NOT NULL DEFAULT 'beauty';

UPDATE empresas
SET sistema_tipo = 'beauty'
WHERE sistema_tipo IS NULL OR sistema_tipo = '';
