# Trading Bot - Automação de Compra e Venda de Criptomoedas
Este projeto é um robô de trading automatizado para a Binance, que monitora o mercado, calcula o RSI (Relative Strength Index) e executa operações de compra e venda de BTC/USDT com base nesses indicadores.

## Funcionalidade da aplicação
- Monitoramento do preço do Bitcoin em tempo real
- Cálculo do RSI para tomada de decisão
- Compra e venda automática conforme critérios predefinidos
- Conversão de saldo para BRL com cotação USDT/BRL
- Registro de operações e cálculo do lucro acumulado

## Tecnologias utilizadas na aplicação
- Node.js (Execução do robô)
- Axios (Requisições HTTP para a Binance)
- Binance API (Para consultar preços e executar ordens)
- Crypto (Assinatura das requisições com HMAC-SHA256)
