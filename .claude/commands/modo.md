Verifique o argumento recebido em "$ARGUMENTS":

- Se vazio ou ausente: execute `.dev/modo.sh status` e exiba o resultado ao usuário.
- Se contém `--dev`: execute `.dev/modo.sh dev` e exiba: "Modo alterado. Saia do Claude Code e abra novamente para ativar."
- Se contém `--user`: execute `.dev/modo.sh op` e exiba: "Modo alterado. Saia do Claude Code e abra novamente para ativar."
- Qualquer outro valor: informe que os argumentos válidos são `--dev` e `--user`.
