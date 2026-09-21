import datetime
import unittest

import teams_chat_export as t

TS_A = "terça-feira, 8 de setembro de 2026 11:09"
TS_B = "quarta-feira, 9 de setembro de 2026 08:30"


class BuildJsonTest(unittest.TestCase):
    def test_estrutura_e_campos(self):
        records = [{"author": "Ana", "timeTitle": TS_A, "text": "Oi"}]
        out = t.build_json("Meu grupo", records, datetime.datetime(2026, 9, 21, 9, 23))
        self.assertEqual(out["grupo"], "Meu grupo")
        self.assertEqual(out["exportado_em"], "2026-09-21T09:23:00")
        self.assertEqual(
            out["mensagens"],
            [{"autor": "Ana", "data_hora_original": TS_A, "texto": "Oi"}],
        )

    def test_autor_ausente_vira_desconhecido(self):
        records = [{"author": None, "timeTitle": TS_A, "text": "Oi"}]
        out = t.build_json("G", records)
        self.assertEqual(out["mensagens"][0]["autor"], "(desconhecido)")

    def test_ordem_cronologica_com_data_ilegivel_no_fim(self):
        records = [
            {"author": "B", "timeTitle": "sem data", "text": "3"},
            {"author": "B", "timeTitle": TS_B, "text": "2"},
            {"author": "A", "timeTitle": TS_A, "text": "1"},
        ]
        out = t.build_json("G", records)
        self.assertEqual([m["texto"] for m in out["mensagens"]], ["1", "2", "3"])


if __name__ == "__main__":
    unittest.main()
