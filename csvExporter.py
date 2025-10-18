import csv

class CsvExporter:
    def __init__(self, csv_file):
        self.csv_file = csv_file

    """
        Export data do CSV
        Args:
            rows: Data řádků pro export
            headerColumnNames: Sloupe záhlaví (volitelné) - pokud není zadáno, záhlaví nebude zahrnuto
    """
    def run(self, rows, headerColumnNames=None):
        with open(self.csv_file, mode='w', newline='') as file:
            writer = csv.writer(file, strict=True)
            if headerColumnNames is not None:
                writer.writerow(headerColumnNames)      # záhlaví
            writer.writerows(rows)                      # data

"""
    Provedeni exportu do CSV
    Args:
        fileName: Název CSV souboru
        rows: Data řádků pro export
        headersColumns: Sloupce záhlaví (volitelné) - pokud není zadáno, záhlaví nebude zahrnuto
"""
def exportCsv(fileName: str, rows: list, headersColumns: list) -> None:
    exporter = CsvExporter(fileName)
    exporter.run(rows, headersColumns)
    print(f"Data is successfully exported to {fileName}")
