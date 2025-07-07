use diesel::{
    prelude::*,
    sql_types::{
        SmallInt,
    },
    serialize::{
        ToSql,
        Result,
        Output,
    },
    backend::Backend,
};

impl<DB> ToSql<SmallInt, DB> for i16
    where
        DB: Backend,
        i16: ToSql<SmallInt, DB>
{
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, DB>) -> Result {
        return self.0.to_sql(out);
    }
}


#[allow(non_camel_case_types)]
#[derive(Debug, Queryable, Selectable, Insertable)]
#[diesel(table_name = crate::schema::buildings)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct DB_Building {
    pub abbrev: String,
    pub name: String,
    pub lsm_name: String,
    #[diesel(serialize_as = SmallInt)]
    pub zone: i16,
}


#[allow(non_camel_case_types)]
#[derive(Queryable, Selectable, Insertable)]
#[diesel(table_name = crate::schema::rooms)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct DB_Room {
    pub abbrev: String,
    pub name: String,
    pub checked: bool,
    pub last_checked: String,
    pub gp: bool,
    pub available: bool,
    pub until: String,
    pub hostnames: Vec<Vec<String>>,
    pub ips: Vec<Vec<String>>
}


#[allow(non_camel_case_types)]
#[derive(Queryable, Selectable, Insertable)]
#[diesel(table_name = crate::schema::admins)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct DB_Admin {
    pub admin: String,
}


#[allow(non_camel_case_types)]
#[derive(Queryable, Selectable, Insertable)]
#[diesel(table_name = crate::schema::data)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct DB_DataElement {
    pub key: String,
    pub val: String,
}